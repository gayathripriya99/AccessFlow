import { Types } from 'mongoose';
import { Tenant, TenantDocument } from '../models/Tenant';

export interface CreateTenantInput {
  name: string;
  slug: string;
}

/** Not itself tenant-scoped — it's the root of the hierarchy every other
 * repository scopes against. */
export class TenantRepository {
  findBySlug(slug: string): Promise<TenantDocument | null> {
    return Tenant.findOne({ slug: slug.toLowerCase() }).exec();
  }

  findById(id: string | Types.ObjectId): Promise<TenantDocument | null> {
    return Tenant.findById(id).exec();
  }

  create(input: CreateTenantInput): Promise<TenantDocument> {
    return Tenant.create(input);
  }
}
