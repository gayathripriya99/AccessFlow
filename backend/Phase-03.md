# Phase 03 — Authorization Middleware

## Objectives completed

- Real permission-based authorization guarding every Phase 2 endpoint (`/api/v1/{permissions,roles,users}/*`), closing the deliberate gap documented in `backend/Phase-02.md` ("any authenticated user can manage any resource").
- Permission resolution is always computed from a user's roles → each role's permissions, flattened to a name set — **never** a hardcoded `role === "Admin"` check, per the master doc's RBAC rule.
- Admin-bootstrap: the very first user ever registered in an empty database automatically receives a baseline set of 11 permissions and an `admin` role bundling them, so a fresh deployment can immediately start managing its own RBAC data without a manual seed step. Every subsequent registration gets zero roles.
- A real security gap closed as a side effect: previously, a deactivated or deleted user's still-valid (stateless) access JWT could hit any Phase 1/2 endpoint, since `requireAuth` only checks the JWT signature, not DB state. `AuthorizationService` now treats a deactivated/deleted user as having zero permissions, so every permission-gated route is implicitly also an active-user check. (`/auth/me` is unaffected — it remains identity-only, unchanged from Phase 1.)

## Files created

```
backend/src/
├── constants/systemPermissions.ts      SYSTEM_PERMISSIONS (11 baseline entries), ADMIN_ROLE_NAME
├── services/
│   ├── AdminBootstrapService.ts        bootstrapFirstUserAsAdmin(user) — idempotent
│   └── AuthorizationService.ts         getPermissionNames(userId) -> Set<string>
└── middlewares/requirePermission.ts    requirePermission(name) factory, 403 on missing permission
```

## Files modified

- `src/repositories/UserRepository.ts` — added `count()` and `findByIdWithPermissions(id)` (nested populate: `roles` → `roles.permissions`).
- `src/services/AuthService.ts` — constructor takes an `AdminBootstrapService`; `register()` calls `bootstrapFirstUserAsAdmin` right after creating the user.
- `src/routes/v1/auth.routes.ts` — wires the new dependency.
- `src/routes/v1/{permission,role,user}.routes.ts` — every route now has `requirePermission('<resource>.<action>')` after `requireAuth`.
- `tests/helpers/authenticatedUser.ts` — added `createNonAdminUser(app)`.
- `tests/{permissions,roles,users}.test.ts` — added a 403 test each; fixed two test-fixture literals (`users.read`, `roles.read`) in `permissions.test.ts` that collided with the new baseline permission names (renamed to `inventory.read`/`catalog.read` — arbitrary example data, no behavior change intended by the rename).

## Permission naming convention

`{resource}.{action}`, lowercase, matching the format Phase 2's Zod validators already enforce for permission names. 11 baseline permissions (no `users.create` — user creation stays at the unguarded `/auth/register`):

`permissions.{create,read,update,delete}`, `roles.{create,read,update,delete}`, `users.{read,update,delete}`.

## Admin bootstrap — how it works

On `POST /auth/register`, after the user document is created, `AdminBootstrapService.bootstrapFirstUserAsAdmin` checks `UserRepository.count() === 1` (this new user is the only one in the system). If so: idempotently find-or-create each of the 11 baseline `Permission` documents, find-or-create the `admin` `Role` bundling all of them, and assign that role to the user. Every later registration is a no-op here (count > 1) and gets zero roles — an existing admin must grant access via `PATCH /users/:id`.

This also just works for tests, since each test's `mongodb-memory-server` database is cleared between tests (`tests/setup.ts`'s `afterEach`) — the first `createAuthenticatedUser()` call within any given test is that test's "first user" and becomes admin automatically.

## Tests

30 tests total (up from 27), all passing:

- One new 403 test per resource (`permissions.test.ts`, `roles.test.ts`, `users.test.ts`), each using `createNonAdminUser` to get a guaranteed-zero-permission caller and asserting both a list-read and a mutating action are rejected.
- All 27 pre-existing Phase 1/2 tests still pass unmodified in behavior (aside from the two renamed literals) — they rely on `createAuthenticatedUser()`'s first call in each test becoming admin, which the bootstrap mechanism provides automatically.

Additionally live-smoke-tested the real HTTP server against a standalone in-memory MongoDB: registered a first user and confirmed they could immediately list the 11 auto-created baseline permissions and create new permissions/roles; registered a second user and confirmed 403 on every permissions/roles/users endpoint; had the admin create a role with only `users.read` attached, assigned it to the second user, and confirmed that user could then list users (200) while still being rejected (403) on roles, permissions, and user-deletion — proving the permission check is genuinely scoped to exactly what was granted, not an all-or-nothing switch.

Verified clean: `npm run build` (strict TS), `npm run lint` (ESLint), `npm test` (30/30).

## Notable decisions (worth knowing before touching this code)

- **Bootstrap is a side effect of `register()`, not a separate script.** Simpler to operate (nothing to remember to run), but it does mean `AuthService` now depends on `AdminBootstrapService` — if register logic is ever refactored, keep this call in place or document its removal deliberately.
- **`requirePermission` runs before request validation** on every route (e.g. before `validateObjectIdParam`/`validateRequest`) — an unauthorized caller gets a 403 without learning anything about whether their input was otherwise well-formed. This is a deliberate ordering choice, not arbitrary.
- **PATCH `/users/:id` is how admin access is granted or revoked** — there's no separate "grant permission" endpoint. An admin assigns/unassigns roles on a user via the same endpoint Phase 2 already built for editing name/isActive.
- **Deactivating or deleting a user immediately revokes all their effective permissions**, even mid-session on an unexpired access token — this happens automatically via `AuthorizationService`, no separate mechanism needed.

## Remaining work (next phases)

- Phase 4: First protected frontend client. No `frontend-*` folders exist yet.
- Phase 5: Audit Log query/viewing API and UI (write path has existed since Phase 1/2).
- Phase 6: Permission Simulator.
- Phase 7: Advanced RBAC.
- Phase 8: ABAC + multi-tenant.
- Not yet addressed: the still-open questions from the `doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md` restructuring (the 13 missing planned docs, where the "Modern AI Chatbot module" fits, and confirming the MongoDB Atlas note doesn't change local/test DB usage).
