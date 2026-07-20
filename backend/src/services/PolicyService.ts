import { CreatePolicyInput, ListPoliciesFilter, PolicyRepository, UpdatePolicyInput } from '../repositories/PolicyRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { ApiError } from '../utils/ApiError';
import { PaginationMeta, PaginationParams, buildPaginationMeta } from '../utils/pagination';
import { RequestContext } from './AuthService';
import { PolicyDocument } from '../models/Policy';
import { CreatePolicyBody, UpdatePolicyBody } from '../validators/policy.validators';

export class PolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async create(input: CreatePolicyBody, context: RequestContext): Promise<PolicyDocument> {
    const existing = await this.policyRepository.findByName(input.name);
    if (existing) {
      throw ApiError.conflict('A policy with this name already exists');
    }

    const policy = await this.policyRepository.create(input as CreatePolicyInput);
    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'policy.create',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { policyId: policy._id.toString(), name: policy.name },
    });
    return policy;
  }

  async list(
    filter: ListPoliciesFilter,
    pagination: PaginationParams,
  ): Promise<{ items: PolicyDocument[]; meta: PaginationMeta }> {
    const { items, total } = await this.policyRepository.list(filter, pagination);
    return { items, meta: buildPaginationMeta(pagination, total) };
  }

  async getById(id: string): Promise<PolicyDocument> {
    const policy = await this.policyRepository.findById(id);
    if (!policy) {
      throw ApiError.notFound('Policy not found');
    }
    return policy;
  }

  async update(id: string, input: UpdatePolicyBody, context: RequestContext): Promise<PolicyDocument> {
    if (input.name) {
      const existing = await this.policyRepository.findByName(input.name);
      if (existing && existing._id.toString() !== id) {
        throw ApiError.conflict('A policy with this name already exists');
      }
    }

    const updated = await this.policyRepository.updateById(id, input as UpdatePolicyInput);
    if (!updated) {
      throw ApiError.notFound('Policy not found');
    }

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'policy.update',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { policyId: id, changes: input },
    });
    return updated;
  }

  async delete(id: string, context: RequestContext): Promise<void> {
    const deleted = await this.policyRepository.deleteById(id);
    if (!deleted) {
      throw ApiError.notFound('Policy not found');
    }

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'policy.delete',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { policyId: id, name: deleted.name },
    });
  }
}
