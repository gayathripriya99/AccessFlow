import { PolicyRepository } from '../repositories/PolicyRepository';
import { PolicyCondition, PolicyDocument } from '../models/Policy';

export type AbacDecision = 'allow' | 'deny' | 'indeterminate';

export interface AbacContext {
  subject: { id: string };
  resource: { type: string; id: string };
  action: string;
}

/**
 * Attribute-based policy evaluation, layered alongside (not instead of) RBAC
 * — see requireAccess middleware for how the two combine. Semantics mirror
 * the standard IAM/OPA convention: an explicit `deny` always wins over any
 * `allow`; if nothing matches, the decision is `indeterminate` and the
 * caller should fall back to an ordinary RBAC permission check.
 */
export class AbacService {
  constructor(private readonly policyRepository: PolicyRepository) {}

  async evaluate(context: AbacContext): Promise<AbacDecision> {
    const policies = await this.policyRepository.findApplicable(context.resource.type, context.action);
    const matching = policies.filter((policy) => this.matches(policy, context));

    if (matching.some((policy) => policy.effect === 'deny')) {
      return 'deny';
    }
    if (matching.some((policy) => policy.effect === 'allow')) {
      return 'allow';
    }
    return 'indeterminate';
  }

  private matches(policy: PolicyDocument, context: AbacContext): boolean {
    return policy.conditions.every((condition) => this.conditionHolds(condition, context));
  }

  private conditionHolds(condition: PolicyCondition, context: AbacContext): boolean {
    const left = resolveAttribute(condition.attribute, context);
    const right = resolveValue(condition.compareTo, context);
    switch (condition.operator) {
      case 'equals':
        return left !== undefined && left === right;
      case 'notEquals':
        return left !== right;
    }
  }
}

function resolveAttribute(path: string, context: AbacContext): unknown {
  const [root, key] = path.split('.');
  if (root === 'subject') {
    return (context.subject as Record<string, unknown>)[key];
  }
  if (root === 'resource') {
    return (context.resource as Record<string, unknown>)[key];
  }
  return undefined;
}

/** `compareTo` is an attribute path (resolved against the context) if it
 * looks like one ("subject.x"/"resource.x"), otherwise a literal string. */
function resolveValue(compareTo: string, context: AbacContext): unknown {
  if (compareTo.startsWith('subject.') || compareTo.startsWith('resource.')) {
    return resolveAttribute(compareTo, context);
  }
  return compareTo;
}
