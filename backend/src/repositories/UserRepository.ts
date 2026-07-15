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
  findByEmail(email: string, withPasswordHash = false): Promise<UserDocument | null> {
    const query = User.findOne({ email: email.toLowerCase() });
    if (withPasswordHash) {
      query.select('+passwordHash');
    }
    return query.exec();
  }

  findById(id: string | Types.ObjectId, populateRoles = false): Promise<UserDocument | null> {
    const query = User.findById(id);
    if (populateRoles) {
      query.populate('roles');
    }
    return query.exec();
  }

  create(input: CreateUserInput): Promise<UserDocument> {
    return User.create(input);
  }

  async list(
    filter: ListUsersFilter,
    pagination: PaginationParams,
  ): Promise<{ items: UserDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
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

  updateById(id: string | Types.ObjectId, input: UpdateUserInput): Promise<UserDocument | null> {
    return User.findByIdAndUpdate(id, input, { new: true, runValidators: true }).populate('roles').exec();
  }

  deleteById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return User.findByIdAndDelete(id).exec();
  }
}
