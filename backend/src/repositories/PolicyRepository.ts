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
  findByName(name: string): Promise<PolicyDocument | null> {
    return Policy.findOne({ name: name.toLowerCase() }).exec();
  }

  findById(id: string | Types.ObjectId): Promise<PolicyDocument | null> {
    return Policy.findById(id).exec();
  }

  create(input: CreatePolicyInput): Promise<PolicyDocument> {
    return Policy.create(input);
  }

  /** Every *enabled* policy matching this resource+action pair — the
   * candidate set AbacService then filters down by condition-matching. */
  findApplicable(resource: string, action: string): Promise<PolicyDocument[]> {
    return Policy.find({ resource, action, enabled: true }).exec();
  }

  async list(
    filter: ListPoliciesFilter,
    pagination: PaginationParams,
  ): Promise<{ items: PolicyDocument[]; total: number }> {
    const query = filter.search ? { name: { $regex: filter.search, $options: 'i' } } : {};
    const [items, total] = await Promise.all([
      Policy.find(query).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit).exec(),
      Policy.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  updateById(id: string | Types.ObjectId, input: UpdatePolicyInput): Promise<PolicyDocument | null> {
    return Policy.findByIdAndUpdate(id, input, { new: true, runValidators: true }).exec();
  }

  deleteById(id: string | Types.ObjectId): Promise<PolicyDocument | null> {
    return Policy.findByIdAndDelete(id).exec();
  }
}
