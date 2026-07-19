# Phase 07 — Advanced RBAC (Role Hierarchy)

## Objectives completed

- **Role hierarchy / inheritance**: a role can now have a `parentRole`, and its *effective* permissions are its own directly-assigned permissions unioned with every ancestor's, transitively. This is the classic textbook "advanced RBAC" feature (NIST's RBAC1, hierarchical RBAC, layered on top of the flat RBAC0 built in Phases 1–3) — deliberately distinct from Phase 8's planned ABAC (attribute-based conditions), which is a different axis entirely.
- Cycle prevention: setting a role's parent to itself, or to a role that is (transitively) already its own descendant, is rejected with 400 — checked on every create/update, not just at the UI layer.
- Deleting a role cascades onto its children the same way deleting a Permission/Role has always cascaded elsewhere in this project: children's `parentRole` is set to `null`, not left as a dangling reference.
- `AuthorizationService.resolveAccess` (used by `requirePermission` on every gated request, and by `/auth/me`) and `SimulatorService` (Phase 6) both walk the hierarchy now — inheritance isn't just a Role-API cosmetic, it actually changes what a user can do, and the Permission Simulator's answers stay consistent with real enforcement.
- `frontend-react`'s Roles page gained a parent-role picker on create/edit, and — when editing — a read-only "Inherits from" chain and "Effective permissions (including inherited)" pill list, fetched from the detail endpoint.
- Like Phases 5 and 6, neither `doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md` nor any other doc says what "Advanced RBAC" should contain — this phase's scoping (role hierarchy specifically, as opposed to e.g. direct user-level permission overrides, separation-of-duties constraints, or other "advanced RBAC" candidates) is this session's own judgment call, chosen for being the single most classically-named advanced-RBAC concept and for pairing cleanly with everything already built (Roles already exist; this extends them rather than adding a new resource).

## Design decisions worth knowing before touching this code

- **No new baseline permission.** Unlike Phases 5 and 6, this phase doesn't add a new resource — it extends the existing `Role` resource, so it's gated by the existing `roles.create`/`roles.update`/`roles.read` permissions. Baseline permission count stays at 13.
- **`effectivePermissions`/`ancestorNames`/populated `parentRole` are only on the detail view (`GET /roles/:id`), never on list rows** — same populated-on-detail-only pattern Phase 4 already established for `permissions` itself (list rows show unpopulated id arrays for performance; the frontend fetches the detail view specifically when editing, via a new `useQuery` in `RolesPage`). `RoleService.getById`'s return type changed from the raw `RoleDocument` to a plain `RoleDetail` object (`{ ...role.toJSON(), effectivePermissions, ancestorNames }`) — a Mongoose document can't have an arbitrary computed property bolted onto it and expect `res.json()` to serialize it (only real schema paths/virtuals survive `toJSON()`), so the controller now receives an already-plain, already-computed object instead.
- **The ancestor walk is one DB round-trip per hierarchy level** (`RoleRepository.getAncestorChain`), not a single-query closure-table/materialized-path lookup. This is a deliberate simplicity-over-premature-optimization tradeoff for a portfolio-scale project — real hierarchies here are expected to be a handful of levels, and `requirePermission` (which calls this indirectly via `resolveAccess`) already does a DB round-trip per request regardless. A production system with deep hierarchies or very high request volume would likely want a materialized/cached closure table instead; not implemented here as there's no evidence it's needed at this project's scale, and `getAncestorChain`'s `maxDepth` (20) plus a `seen`-set bound the worst case regardless.
- **A role "grants" a permission (for `SimulatorService.grantedByRoles` and `AuthorizationService`) if it does so directly *or* via its ancestor chain.** From a user's perspective, "I have role X, therefore I can do Y" is true whether X or one of X's ancestors actually carries the permission — the simulator attributes the grant to the role the caller was actually checking against (e.g. the directly-assigned child role), not to the ancestor that happens to hold the permission, since that's the more useful/actionable answer for "why can this user do this."
- **The parent-role `<select>` doesn't client-side-filter out a role's own descendants** — it only excludes the role itself. Picking a role that would create a transitive cycle is allowed to *attempt*, and the backend's `wouldCreateCycle` check is the actual source of truth (400 + a clear error message on save). This mirrors the existing project convention of client-side convenience filtering (e.g. Permission/Role checkboxes) backed by a server-side check as the real guarantee, not a client-only guard that could be bypassed or drift out of sync.

## Files created

```
backend/
└── Phase-07.md
```

No new backend files otherwise — this phase modifies the existing `Role`/`AuthorizationService`/`SimulatorService` stack rather than adding a new resource.

## Files modified

- `backend/src/models/Role.ts` — added `parentRole: Types.ObjectId | null`.
- `backend/src/repositories/RoleRepository.ts` — `getAncestorChain(roleId, maxDepth=20)`, `wouldCreateCycle(roleId, proposedParentId)`, `deleteById` now nulls children's `parentRole`, `findById`/`updateById` populate `parentRole` (name only) alongside `permissions`.
- `backend/src/services/RoleService.ts` — `create`/`update` validate+resolve `parentRoleId` (existence, cycle-check, explicit-null-to-clear vs. undefined-to-leave-unchanged); `getById` now returns the `RoleDetail` shape described above.
- `backend/src/validators/role.validators.ts` — `parentRoleId: objectIdSchema.nullable().optional()` on both create and update schemas.
- `backend/src/services/AuthorizationService.ts` — constructor now also takes `RoleRepository`; `resolveAccess` walks each of the user's roles' ancestor chains when flattening permission names.
- `backend/src/services/SimulatorService.ts` — `resolve()` is now async and walks each role's ancestor chain before checking/aggregating, so simulated answers match real enforcement.
- `backend/src/middlewares/requirePermission.ts`, `backend/src/routes/v1/auth.routes.ts` — both `AuthorizationService` construction sites updated to also inject `RoleRepository`.
- `backend/tests/roles.test.ts` — new `describe('Role hierarchy (Phase 7)', ...)` block (creation with a parent, unknown-parent 400, self-cycle and transitive-cycle 400, an end-to-end test proving inherited permissions authorize a *real* gated request — not just that the Role API reports the right shape — and cascade-null-on-delete / explicit-clear-via-null).
- `backend/tests/simulator.test.ts` — one new test proving a role with zero direct permissions is still reported as `grantedByRoles` when the permission comes from its parent.
- `frontend-react/src/api/types.ts` — `Role` gained `parentRole?`, `effectivePermissions?`, `ancestorNames?`.
- `frontend-react/src/api/roles.ts` — `CreateRoleInput`/`UpdateRoleInput` gained `parentRoleId?: string | null`.
- `frontend-react/src/pages/RolesPage.tsx` — parent-role `<select>` in the form; a detail fetch (`getRole`) when editing, feeding the parent-select's value and the read-only "Inherits from"/"Effective permissions" sections; submit always sends `parentRoleId` as a real id or explicit `null` (never an empty string, which the backend's validator would reject).
- `frontend-react/src/i18n/locales/{en,hi,kn,fr}.json` — added `roles.parentRole`/`noParent`/`inheritsFrom`/`effectivePermissions`, to all 4 files together.
- `CLAUDE.md`, `README.md`, `backend/README.md` — phase-complete status, API summary, architecture notes (see below).

## Verification

- `cd backend && npm run build && npm run lint && npm test` — clean; 54/54 tests passing (47 pre-existing + 7 new).
- `cd frontend-react && npm run build && npm run lint` — clean (same one pre-existing harmless warning as every prior phase).
- **Live browser verification** (Playwright, same approach as Phases 4–6): created a parent role (`senior-manager`, holding `org.manage`) and a child role (`manager`, holding zero direct permissions, parent = `senior-manager`) entirely through the UI; confirmed the edit form shows "Inherits from: senior-manager" and "Effective permissions: org.manage" even though the list view correctly shows `manager`'s own permission count as `0`; assigned `manager` to a second, previously permission-less user and confirmed the Permission Simulator reports them `Allowed` for `org.manage`, granted by `manager` (proving the inheritance is real authorization behavior, not just a Role-API display artifact); attempted to set `senior-manager`'s parent to `manager` (its own child) and confirmed a clear "would create a role hierarchy cycle" error, no state changed; deleted `senior-manager` and confirmed `manager` survived with its parent cleared. All checks passed on this run — the only issues hit along the way were test-locator ambiguities (non-exact text matches against strings that appear in multiple places, e.g. "manager" matching both `manager` and `senior-manager`), not application bugs, fixed by tightening the script's own locators.
- Hit the by-now-familiar auth-rate-limiter-exhaustion gotcha once more from iterative script runs; resolved the same documented way (`netstat -ano | grep LISTENING` for the real PID).

## Remaining work (next phases)

- Phase 8: ABAC + multi-tenant.
- Direct user-level permission overrides (grant/deny a specific permission to a specific user regardless of role) — a different "advanced RBAC" feature this phase didn't build; worth considering for a future phase if role hierarchy alone doesn't cover a real use case that comes up.
- No `userId`-filter picker on the audit log page (from Phase 5, still open).
- No automated frontend tests (`*.test.tsx`); Playwright remains available as a devDependency.
- `frontend-angular`/`frontend-vue`/`frontend-nextjs` don't exist.
- The roadmap-reorder question remains formally unresolved (functionally, the existing ordering has now been used for three phases running).
- No CI/CD or deployment configuration.
