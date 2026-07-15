import { Types } from 'mongoose';
import { User, UserDocument } from '../models/User';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export class UserRepository {
  findByEmail(email: string, withPasswordHash = false): Promise<UserDocument | null> {
    const query = User.findOne({ email: email.toLowerCase() });
    if (withPasswordHash) {
      query.select('+passwordHash');
    }
    return query.exec();
  }

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return User.findById(id).exec();
  }

  create(input: CreateUserInput): Promise<UserDocument> {
    return User.create(input);
  }
}
