import { Types } from 'mongoose';
import { User, UserDocument } from '../models/User';
import { PaginationParams } from '../utils/pagination';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface UpdateUserInput {
  name?: string;
  isActive?: boolean;
  roles?: Types.ObjectId[];
}

export interface ListUsersFilter {
  search?: string;
  isActive?: boolean;
}

export class UserRepository {
  findByEmail(
    tenantId: string | Types.ObjectId,
    email: string,
    withPasswordHash = false,
  ): Promise<UserDocument | null> {
    const query = User.findOne({ tenantId, email: email.toLowerCase() });
    if (withPasswordHash) {
      query.select('+passwordHash');
    }
    return query.exec();
  }

  findById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    populateRoles = false,
  ): Promise<UserDocument | null> {
    const query = User.findOne({ _id: id, tenantId });
    if (populateRoles) {
      query.populate('roles');
    }
    return query.exec();
  }

  /**
   * The one deliberate exception to "every method takes tenantId first" —
   * used only by the refresh-token flow, where a bare user id is all that's
   * known (the JWT refresh payload carries no tenant claim) and the
   * resulting document's own `tenantId` field is what re-establishes tenant
   * context for the rest of that request. Never use this where the caller's
   * tenantId is already known.
   */
  findByIdAcrossTenants(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return User.findById(id).exec();
  }

  findByIdWithPermissions(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
  ): Promise<UserDocument | null> {
    return User.findOne({ _id: id, tenantId })
      .populate({ path: 'roles', populate: { path: 'permissions' } })
      .exec();
  }

  count(tenantId: string | Types.ObjectId): Promise<number> {
    return User.countDocuments({ tenantId }).exec();
  }

  create(tenantId: string | Types.ObjectId, input: CreateUserInput): Promise<UserDocument> {
    return User.create({ ...input, tenantId });
  }

  async list(
    tenantId: string | Types.ObjectId,
    filter: ListUsersFilter,
    pagination: PaginationParams,
  ): Promise<{ items: UserDocument[]; total: number }> {
    const query: Record<string, unknown> = { tenantId };
    if (filter.search) {
      query.$or = [
        { email: { $regex: filter.search, $options: 'i' } },
        { name: { $regex: filter.search, $options: 'i' } },
      ];
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }

    const [items, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).exec(),
      User.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  updateById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: UpdateUserInput,
  ): Promise<UserDocument | null> {
    return User.findOneAndUpdate({ _id: id, tenantId }, input, { new: true, runValidators: true })
      .populate('roles')
      .exec();
  }

  deleteById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<UserDocument | null> {
    return User.findOneAndDelete({ _id: id, tenantId }).exec();
  }
}
