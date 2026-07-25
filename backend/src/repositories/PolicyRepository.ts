import { Types } from 'mongoose';
import { Policy, PolicyCondition, PolicyDocument, PolicyEffect } from '../models/Policy';
import { PaginationParams } from '../utils/pagination';

export interface CreatePolicyInput {
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  enabled?: boolean;
}

export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  resource?: string;
  action?: string;
  effect?: PolicyEffect;
  conditions?: PolicyCondition[];
  enabled?: boolean;
}

export interface ListPoliciesFilter {
  search?: string;
}

export class PolicyRepository {
  findByName(tenantId: string | Types.ObjectId, name: string): Promise<PolicyDocument | null> {
    return Policy.findOne({ tenantId, name: name.toLowerCase() }).exec();
  }

  findById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<PolicyDocument | null> {
    return Policy.findOne({ _id: id, tenantId }).exec();
  }

  create(tenantId: string | Types.ObjectId, input: CreatePolicyInput): Promise<PolicyDocument> {
    return Policy.create({ ...input, tenantId });
  }

  /** Every *enabled* policy matching this resource+action pair, scoped to
   * the caller's tenant — the candidate set AbacService then filters down by
   * condition-matching. */
  findApplicable(
    tenantId: string | Types.ObjectId,
    resource: string,
    action: string,
  ): Promise<PolicyDocument[]> {
    return Policy.find({ tenantId, resource, action, enabled: true }).exec();
  }

  async list(
    tenantId: string | Types.ObjectId,
    filter: ListPoliciesFilter,
    pagination: PaginationParams,
  ): Promise<{ items: PolicyDocument[]; total: number }> {
    const query: Record<string, unknown> = { tenantId };
    if (filter.search) {
      query.name = { $regex: filter.search, $options: 'i' };
    }
    const [items, total] = await Promise.all([
      Policy.find(query).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit).exec(),
      Policy.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  updateById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: UpdatePolicyInput,
  ): Promise<PolicyDocument | null> {
    return Policy.findOneAndUpdate({ _id: id, tenantId }, input, { new: true, runValidators: true }).exec();
  }

  deleteById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<PolicyDocument | null> {
    return Policy.findOneAndDelete({ _id: id, tenantId }).exec();
  }
}
