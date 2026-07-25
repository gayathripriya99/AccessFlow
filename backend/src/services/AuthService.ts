import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UserRepository } from '../repositories/UserRepository';
import { TenantRepository } from '../repositories/TenantRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { AdminBootstrapService } from './AdminBootstrapService';
import { AuthorizationService } from './AuthorizationService';
import { ApiError } from '../utils/ApiError';
import { hashToken } from '../utils/hashToken';
import {
  getTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { UserDocument } from '../models/User';
import { TenantDocument } from '../models/Tenant';
import { RegisterInput as RegisterBody, LoginInput as LoginBody } from '../validators/auth.validators';

const BCRYPT_SALT_ROUNDS = 12;

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  // Id of the authenticated caller performing the action — unset for
  // pre-authentication flows (register/login), set for authenticated
  // management actions (Permission/Role/User CRUD) so audit logs record who
  // performed the change, not just who it affected.
  actorId?: string | null;
}

export type RegisterInput = RegisterBody;
export type LoginInput = LoginBody;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface CurrentUser extends PublicUser {
  roles: string[];
  permissions: string[];
  tenant: { id: string; name: string; slug: string };
}

function toPublicUser(user: UserDocument): PublicUser {
  return { id: user._id.toString(), email: user.email, name: user.name };
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly adminBootstrapService: AdminBootstrapService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async register(input: RegisterInput, context: RequestContext): Promise<PublicUser> {
    const tenant =
      input.mode === 'create' ? await this.createTenant(input.tenantName, input.tenantSlug) : await this.findTenantOrThrow(input.tenantSlug);

    const existing = await this.userRepository.findByEmail(tenant._id, input.email);
    if (existing) {
      throw ApiError.conflict('An account with this email already exists in this organization');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await this.userRepository.create(tenant._id, {
      email: input.email,
      passwordHash,
      name: input.name,
    });

    await this.adminBootstrapService.bootstrapFirstUserAsAdmin(tenant._id, user);

    await this.auditLogRepository.record(tenant._id, {
      userId: user._id,
      action: 'auth.register',
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return toPublicUser(user);
  }

  async login(input: LoginInput, context: RequestContext): Promise<{ user: PublicUser } & AuthTokens> {
    const tenant = await this.tenantRepository.findBySlug(input.tenantSlug);
    if (!tenant) {
      // Don't distinguish "no such org" from "wrong password" — avoids
      // leaking which organization slugs exist to an unauthenticated caller.
      throw ApiError.unauthorized('Invalid email, password, or organization');
    }

    const user = await this.userRepository.findByEmail(tenant._id, input.email, true);
    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

    if (!user || !user.isActive || !passwordMatches) {
      await this.auditLogRepository.record(tenant._id, {
        userId: user?._id ?? null,
        action: 'auth.login.failure',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { email: input.email },
      });
      throw ApiError.unauthorized('Invalid email, password, or organization');
    }

    const tokens = await this.issueTokenPair(tenant._id, user._id);

    await this.auditLogRepository.record(tenant._id, {
      userId: user._id,
      action: 'auth.login.success',
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { user: toPublicUser(user), ...tokens };
  }

  async refresh(presentedToken: string, context: RequestContext): Promise<AuthTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = verifyRefreshToken(presentedToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const stored = await this.refreshTokenRepository.findById(payload.jti);
    if (!stored || stored.userId.toString() !== payload.sub) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    if (stored.revokedAt || stored.tokenHash !== hashToken(presentedToken)) {
      // Token was already rotated out (or tampered with) — someone is
      // replaying an old refresh token. Treat the whole session as
      // compromised and revoke every active token for this user.
      await this.refreshTokenRepository.revokeAllForUser(payload.sub);
      const user = await this.userRepository.findByIdAcrossTenants(payload.sub);
      if (user) {
        await this.auditLogRepository.record(user.tenantId, {
          userId: new Types.ObjectId(payload.sub),
          action: 'auth.refresh.reuse_detected',
          ip: context.ip,
          userAgent: context.userAgent,
        });
      }
      throw ApiError.unauthorized('Refresh token has already been used');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    // The refresh token carries no tenant claim (by design — see
    // RefreshTokenRepository), so the user's own tenantId re-establishes
    // tenant context for the rest of this flow.
    const user = await this.userRepository.findByIdAcrossTenants(stored.userId);
    if (!user) {
      throw ApiError.unauthorized('User no longer exists');
    }

    const tokens = await this.issueTokenPair(user.tenantId, stored.userId, stored._id);

    await this.auditLogRepository.record(user.tenantId, {
      userId: stored.userId,
      action: 'auth.refresh',
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return tokens;
  }

  async logout(presentedToken: string, context: RequestContext): Promise<void> {
    try {
      const payload = verifyRefreshToken(presentedToken);
      await this.refreshTokenRepository.revoke(payload.jti);
      const user = await this.userRepository.findByIdAcrossTenants(payload.sub);
      if (user) {
        await this.auditLogRepository.record(user.tenantId, {
          userId: new Types.ObjectId(payload.sub),
          action: 'auth.logout',
          ip: context.ip,
          userAgent: context.userAgent,
        });
      }
    } catch {
      // Already invalid/expired/missing — logout is idempotent either way.
    }
  }

  async getCurrentUser(tenantId: string, userId: string): Promise<CurrentUser> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw ApiError.notFound('Organization not found');
    }
    const { roleNames, permissionNames } = await this.authorizationService.resolveAccess(tenantId, userId);
    return {
      ...toPublicUser(user),
      roles: roleNames,
      permissions: Array.from(permissionNames),
      tenant: { id: tenant._id.toString(), name: tenant.name, slug: tenant.slug },
    };
  }

  private async createTenant(name: string, slug: string): Promise<TenantDocument> {
    const existing = await this.tenantRepository.findBySlug(slug);
    if (existing) {
      throw ApiError.conflict('An organization with this slug already exists');
    }
    return this.tenantRepository.create({ name, slug });
  }

  private async findTenantOrThrow(slug: string): Promise<TenantDocument> {
    const tenant = await this.tenantRepository.findBySlug(slug);
    if (!tenant) {
      throw ApiError.notFound('No organization found with this slug');
    }
    return tenant;
  }

  private async issueTokenPair(
    tenantId: Types.ObjectId,
    userId: Types.ObjectId,
    oldTokenId?: Types.ObjectId,
  ): Promise<AuthTokens> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) {
      throw ApiError.unauthorized('User no longer exists');
    }

    const newTokenId = new Types.ObjectId();
    const refreshToken = signRefreshToken({ sub: userId.toString(), jti: newTokenId.toString() });
    const expiresAt = getTokenExpiry(refreshToken);

    await this.refreshTokenRepository.create({
      _id: newTokenId,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });
    if (oldTokenId) {
      await this.refreshTokenRepository.revoke(oldTokenId, newTokenId);
    }

    const accessToken = signAccessToken({ sub: userId.toString(), email: user.email, tenantId: tenantId.toString() });

    return { accessToken, refreshToken };
  }
}
