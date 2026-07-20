import { PolicyCondition, PolicyEffect } from '../models/Policy';

export interface SystemPolicyDefinition {
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  enabled: boolean;
}

const SELF: PolicyCondition = { attribute: 'resource.id', operator: 'equals', compareTo: 'subject.id' };

/**
 * Seeded (idempotently, like SYSTEM_PERMISSIONS) the moment the first user
 * ever registers — see AdminBootstrapService. Demonstrates the two ways ABAC
 * meaningfully applies to this domain, where "attributes" really only means
 * "is this my own record":
 *
 * - Two `allow` policies let *any* authenticated user view/update their own
 *   profile even without `users.read`/`users.update` (UserService still
 *   restricts a permission-less self-update to the `name` field only — see
 *   its doc comment — so this can't be used to self-grant roles).
 * - One `deny` policy blocks anyone, including admins, from deleting their
 *   own account through this endpoint — a deliberate deny-overrides-allow
 *   demonstration, not just an allow-only feature.
 *
 * All three are ordinary Policy documents once created — an admin with
 * `policies.delete` can remove or disable any of them via the API/UI.
 */
export const SYSTEM_POLICIES: SystemPolicyDefinition[] = [
  {
    name: 'self-service-read',
    description: 'Any user may view their own profile, even without users.read',
    resource: 'user',
    action: 'read',
    effect: 'allow',
    conditions: [SELF],
    enabled: true,
  },
  {
    name: 'self-service-update',
    description: 'Any user may update their own profile, even without users.update (name only — enforced in UserService)',
    resource: 'user',
    action: 'update',
    effect: 'allow',
    conditions: [SELF],
    enabled: true,
  },
  {
    name: 'deny-self-delete',
    description: 'No user, including administrators, may delete their own account through this endpoint',
    resource: 'user',
    action: 'delete',
    effect: 'deny',
    conditions: [SELF],
    enabled: true,
  },
];
