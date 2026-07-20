# Phase 08 — ABAC (Attribute-Based Access Control)

## Scope decision

The original roadmap named this phase "ABAC + Multi-tenant." Before starting, the user was asked how to scope it, since the two are large, separate architectural concerns — multi-tenant in particular would touch nearly every model, query, and test in the backend (a `tenantId` on every collection, every uniqueness constraint going from global to per-tenant, a JWT claim, etc.), a different scale of change than anything in Phases 5–7. **The user chose ABAC only, deferring multi-tenant to a future phase.** This document covers ABAC exclusively; multi-tenant remains unstarted.

## Objectives completed

- A new **Policy** resource (`resource`+`action`+`effect`+`conditions`+`enabled`) — full CRUD, gated by 4 new baseline permissions (`policies.create/read/update/delete`), following the exact same layering as every prior resource.
- **`AbacService`**: evaluates applicable policies for a `{subject, resource, action}` context using the standard IAM/OPA convention — an explicit `deny` always wins over any `allow`; if nothing matches, the decision is `indeterminate`.
- **`requireAccess` middleware** (new, alongside `requirePermission`): checks ABAC first, RBAC second. An `allow` policy grants access even without the matching permission; a `deny` policy blocks even a caller who *does* have the permission; `indeterminate` falls back to an ordinary `requirePermission`-style check. Wired onto the three single-resource Users routes (`GET/PATCH/DELETE /users/:id`) — list stays RBAC-only, since ABAC needs a single resource id to evaluate against.
- **Three seeded policies** (`backend/src/constants/systemPolicies.ts`, created idempotently by `AdminBootstrapService` alongside the baseline permissions): `self-service-read` and `self-service-update` (allow) let any user view/update their own profile without `users.read`/`users.update`; `deny-self-delete` blocks *everyone*, including admins, from deleting their own account through this endpoint. All three are ordinary Policy documents once created — deletable/editable like anything else.
- **A real privilege-escalation guard**: a self-service update reaching `UserService.update` without genuine `users.update` may only ever change `name` — attempting to change `roles` or `isActive` this way is rejected with 403. Without this, "update your own profile" would double as "grant yourself any role you like," which would make the entire RBAC system pointless.
- `frontend-react` gets a `PoliciesPage` — full CRUD with a small repeatable conditions editor (attribute / operator / compare-to rows), following the established list/form pattern.

## Why this domain's ABAC use case is "self-service," specifically

Unlike a typical ABAC example (documents with owners, departments, sensitivity labels), this project's resources are RBAC configuration data — Permissions and Roles don't belong to anyone, and Users don't have an "owner" other than themselves. The only attribute relationship that actually exists in this domain is **identity**: is the resource being acted on the same as the caller? That's exactly what all three seeded policies check (`resource.id == subject.id`). This is a real, common, and legitimate ABAC use case in production IAM systems (AWS IAM's `aws:userid` condition keys work the same way) — it wasn't invented to have something to demo; it's what "attributes" actually means for a system whose only real resource is user identity.

## Design decisions worth knowing before touching this code

- **Conditions are structured data, never a string passed to `eval()`.** `{ attribute: "resource.id", operator: "equals", compareTo: "subject.id" }` — a closed, small language (only `equals`/`notEquals`, only dot-paths into `subject`/`resource`) is enough for what this domain needs and carries none of the injection risk an expression evaluator would. `compareTo` resolves as an attribute path if it starts with `subject.`/`resource.`, otherwise as a literal string — so a policy *could* compare against a hardcoded value, even though none of the seeded ones do.
- **`resource`/`action` are closed enums at the validator level** (`z.enum(['user'])`, `z.enum(['read', 'update', 'delete'])`), not open strings, even though the `Policy` model itself stores plain strings. A typo'd resource/action would otherwise create a policy that silently never matches anything — the enum catches that at creation time. Widening to more resources later just means adding to the enum, not a migration.
- **No new baseline-permission-count surprises beyond the obvious**: `policies.*` (4 new permissions) brings the baseline set to **17**. Every place that hardcoded the old count (tests, docs) needed updating — same pattern as every prior phase that added a permission.
- **One pre-existing test needed updating, not because of a bug but because of an intentional behavior change**: `users.test.ts`'s "rejects a non-admin with 403" test used to PATCH the caller's *own* id as its "any update should 403" case — that's now correctly *allowed* (name-only) by design, so the test was updated to target a genuinely different user instead, which still correctly 403s. Documented in the commit rather than silently changed, since a reviewer diffing this test needs to know the assertion flip was deliberate.
- **The Permission Simulator (Phase 6) was deliberately *not* extended to know about ABAC this phase.** Teaching it "would this specific resource instance be allowed" would need a resource-id input in addition to permission — real scope creep beyond what "ABAC only" was meant to bound. Noted as follow-up work, not silently skipped.
- **The list endpoint (`GET /users`) has no ABAC layer.** There's no single resource id to evaluate a condition against when listing many rows, so it stays exactly as it was — permission-gated only. This is why a self-service user can view/edit their own profile via direct API/URL access but still can't open the Users *list* page in the UI without `users.read` (confirmed in live verification, not just asserted).

## Files created

```
backend/src/
├── models/Policy.ts                     Policy schema — resource/action/effect/conditions/enabled
├── repositories/PolicyRepository.ts      CRUD + findApplicable(resource, action)
├── services/AbacService.ts               evaluate() — allow/deny/indeterminate
├── services/PolicyService.ts             CRUD + audit logging, mirrors PermissionService
├── controllers/PolicyController.ts       HTTP-only, mirrors PermissionController
├── routes/v1/policy.routes.ts            full CRUD, mounted at /policies
├── middlewares/requireAccess.ts          ABAC-then-RBAC route guard
└── constants/systemPolicies.ts           the 3 seeded policies

backend/tests/policies.test.ts            Policy CRUD gating/validation + the ABAC integration
                                           tests described above (self-read/update/delete,
                                           field restriction, enabled-flag/delete live effect)

frontend-react/src/
├── api/policies.ts                       listPolicies/getPolicy/createPolicy/updatePolicy/deletePolicy
└── pages/PoliciesPage.tsx                CRUD + conditions sub-editor
```

## Files modified

- `backend/src/constants/systemPermissions.ts` — added `policies.create/read/update/delete`. Baseline count 13 → **17**.
- `backend/src/models/AuditLog.ts` — added `policy.create/update/delete` to `AUDIT_ACTIONS`.
- `backend/src/services/AdminBootstrapService.ts` — takes a `PolicyRepository` now; seeds `SYSTEM_POLICIES` idempotently alongside the baseline permissions/admin role.
- `backend/src/routes/v1/auth.routes.ts` — `AdminBootstrapService` construction updated for the new dependency.
- `backend/src/routes/v1/user.routes.ts` — `GET/PATCH/DELETE /:id` switched from `requirePermission` to `requireAccess`; `GET /` (list) unchanged.
- `backend/src/services/UserService.ts` — takes an `AuthorizationService` now; `update()` gained the self-service field-restriction check described above.
- `backend/src/routes/v1/index.ts` — mounts the new router at `/policies`.
- `backend/tests/auth.test.ts` — bootstrap-admin permission-count assertion updated 13 → 17.
- `backend/tests/users.test.ts` — the non-admin-403 test's update target changed from self to a different user (see "Design decisions" above for why).
- `frontend-react/src/api/types.ts` — added `Policy`, `PolicyCondition`, `PolicyEffect`, `PolicyOperator`, `PolicyResource`, `PolicyAction`; `AUDIT_ACTIONS` gained the 3 `policy.*` values.
- `frontend-react/src/config/navigation.ts` — added the `policies` entry (permission: `policies.read`).
- `frontend-react/src/App.tsx` — added the `policies` route, wrapped in `RequirePermission`.
- `frontend-react/src/i18n/locales/{en,hi,kn,fr}.json` — added `nav.policies` and the full `policies.*` key group, to all 4 files together.

## Verification

- `cd backend && npm run build && npm run lint && npm test` — clean; 63/63 tests passing (54 pre-existing + 9 new in `policies.test.ts`, 1 pre-existing test updated for the intentional behavior change).
- `cd frontend-react && npm run build && npm run lint` — clean (same one pre-existing harmless warning as every prior phase).
- **Live browser verification** (Playwright, same approach as Phases 4–7; used `context.request` for setup calls that aren't the feature under test, same technique as Phase 6/7): confirmed all 3 seeded policies exist after first-user bootstrap; a permission-less user could `GET` their own profile (200) but not another user's (403, via the real API, not just the Policy API's reported shape); the same user renamed themself (200) but was rejected (403) attempting to grant themself a role or flip their own `isActive`; a user granted `users.delete` via a role could delete someone else (204) but not themself (403 — the deny policy winning over a real RBAC grant, not just over the allow policies); disabling the `self-service-read` policy through the UI immediately removed that user's ability to view their own profile (403), proving the policy is live-evaluated, not cached; a non-admin's Sidebar hides the Policies link and a direct `/policies` URL gives a real 403. All checks passed; the only issues hit during verification were test-script row-scan timing (same recurring class as Phases 4/7, fixed with an explicit `waitFor` before scanning table rows), not application bugs.
- Hit the familiar auth-rate-limiter-exhaustion gotcha again from iterative runs; resolved the same documented way (`netstat -ano | grep LISTENING` for the real PID).

## Remaining work

- **Multi-tenant** — explicitly deferred this phase per the user's scoping decision; still fully unstarted. Would need `tenantId` on `User`/`Role`/`Permission`/`AuditLog`/`Policy`, tenant-scoped uniqueness (email, permission/role/policy names), a JWT tenant claim, and tenant-filtering added to every repository query and route — a larger, separate undertaking.
- Permission Simulator not extended to evaluate ABAC — deliberately out of scope this phase (see "Design decisions" above), would need a resource-id input in addition to the permission being checked.
- ABAC currently only supports the `user` resource (by design, since it's the only one with a meaningful identity-based attribute in this domain) — widening to other resources would need real ownership/attribute data to exist on those resources first, which none currently have.
- No automated frontend tests (`*.test.tsx`); Playwright remains available as a devDependency.
- No `userId`-filter picker on the audit log page (Phase 5, still open).
- `frontend-angular`/`frontend-vue`/`frontend-nextjs` don't exist.
- The roadmap-reorder question remains formally unresolved.
- No CI/CD or deployment configuration.
