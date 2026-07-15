import { Types } from 'mongoose';
import { RefreshToken, RefreshTokenDocument } from '../models/RefreshToken';

export interface CreateRefreshTokenInput {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

export class RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenDocument> {
    return RefreshToken.create(input);
  }

  findById(id: string | Types.ObjectId): Promise<RefreshTokenDocument | null> {
    return RefreshToken.findById(id).exec();
  }

  async revoke(id: string | Types.ObjectId, replacedByToken?: Types.ObjectId): Promise<void> {
    await RefreshToken.updateOne(
      { _id: id },
      { revokedAt: new Date(), ...(replacedByToken ? { replacedByToken } : {}) },
    ).exec();
  }

  async revokeAllForUser(userId: string | Types.ObjectId): Promise<void> {
    await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() }).exec();
  }
}
