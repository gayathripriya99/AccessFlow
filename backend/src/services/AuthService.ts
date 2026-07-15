import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UserRepository } from '../repositories/UserRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { ApiError } from '../utils/ApiError';
import { hashToken } from '../utils/hashToken';
import {
  getTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { UserDocument } from '../models/User';

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

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

function toPublicUser(user: UserDocument): PublicUser {
  return { id: user._id.toString(), email: user.email, name: user.name };
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async register(input: RegisterInput, context: RequestContext): Promise<PublicUser> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await this.userRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    await this.auditLogRepository.record({
      userId: user._id,
      action: 'auth.register',
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return toPublicUser(user);
  }

  async login(input: LoginInput, context: RequestContext): Promise<{ user: PublicUser } & AuthTokens> {
    const user = await this.userRepository.findByEmail(input.email, true);
    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

    if (!user || !user.isActive || !passwordMatches) {
      await this.auditLogRepository.record({
        userId: user?._id ?? null,
        action: 'auth.login.failure',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { email: input.email },
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = await this.issueTokenPair(user._id);

    await this.auditLogRepository.record({
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
      await this.auditLogRepository.record({
        userId: new Types.ObjectId(payload.sub),
        action: 'auth.refresh.reuse_detected',
        ip: context.ip,
        userAgent: context.userAgent,
      });
      throw ApiError.unauthorized('Refresh token has already been used');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const tokens = await this.issueTokenPair(stored.userId, stored._id);

    await this.auditLogRepository.record({
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
      await this.auditLogRepository.record({
        userId: new Types.ObjectId(payload.sub),
        action: 'auth.logout',
        ip: context.ip,
        userAgent: context.userAgent,
      });
    } catch {
      // Already invalid/expired/missing — logout is idempotent either way.
    }
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return toPublicUser(user);
  }

  private async issueTokenPair(userId: Types.ObjectId, oldTokenId?: Types.ObjectId): Promise<AuthTokens> {
    const user = await this.userRepository.findById(userId);
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

    const accessToken = signAccessToken({ sub: userId.toString(), email: user.email });

    return { accessToken, refreshToken };
  }
}
