# Phase 02 — Users / Roles / Permissions CRUD

## Objectives completed

- `Permission` and `Role` data models, wiring up the `User.roles` field that was reserved (unused) since Phase 1.
- Full CRUD for Permissions and Roles, and list/read/update/delete for Users (creation stays at `/auth/register` — not duplicated).
- Referential-integrity cascades: deleting a Permission pulls it out of every Role that referenced it; deleting a Role pulls it out of every User that referenced it; deleting a User revokes all of their refresh tokens (immediate session logout).
- Pagination and filtering on all three list endpoints via one shared utility (`src/utils/pagination.ts`), per the master doc's coding-standards requirement.
- Audit logging extended to cover all mutating actions on the three new resources, recording which authenticated user performed each change.
- All new routes protected by `requireAuth` (proves identity) only — no permission-based authorization yet. That's explicitly Phase 3's job; this phase deliberately stops at "CRUD exists," matching the master doc's own phase separation.
- Fixed a real bug found during testing: Mongoose doesn't serialize its `id` virtual by default, so raw-document API responses were leaking Mongo's `_id`/`__v` instead of a clean `id`. Added a shared `toJSON` transform (`src/models/schemaOptions.ts`) applied to `User`, `Permission`, and `Role`.

## Files created

```
backend/
├── src/
│   ├── models/          Permission.ts, Role.ts, schemaOptions.ts (new); AuditLog.ts, User.ts (extended)
│   ├── repositories/     PermissionRepository.ts, RoleRepository.ts (new); UserRepository.ts, AuditLogRepository.ts (extended)
│   ├── services/         PermissionService.ts, RoleService.ts, UserService.ts (new); AuthService.ts (RequestContext gained actorId)
│   ├── controllers/      PermissionController.ts, RoleController.ts, UserController.ts
│   ├── routes/v1/        permission.routes.ts, role.routes.ts, user.routes.ts (new); index.ts (mounts them)
│   ├── validators/       permission.validators.ts, role.validators.ts, user.validators.ts, pagination.validators.ts
│   ├── middlewares/      validateObjectIdParam.ts
│   └── utils/            pagination.ts, objectId.ts
└── tests/
    ├── helpers/authenticatedUser.ts   (shared register+login-for-a-token helper)
    ├── permissions.test.ts, roles.test.ts, users.test.ts
```

## APIs added

All under `/api/v1`, all requiring `Authorization: Bearer <accessToken>`:

- `POST|GET /permissions`, `GET|PATCH|DELETE /permissions/:id`
- `POST|GET /roles`, `GET|PATCH|DELETE /roles/:id`
- `GET /users`, `GET|PATCH|DELETE /users/:id`

Full request/response shapes, query params, and status codes are documented in [backend/README.md](README.md#api-summary).

## Database updates

New collections: `permissions`, `roles`. `users` collection unchanged in shape, but `roles: ObjectId[]` is now actively populated/queried. `auditlogs`' `action` enum extended with `permission.*`, `role.*`, `user.update`, `user.delete`. Full field-level detail in [backend/README.md](README.md#database).

## Components

Backend only (no frontend yet — starts Phase 4, per the master doc's phase ordering).

## Tests

27 tests total across 4 suites (`auth.test.ts` unchanged from Phase 1, plus new `permissions.test.ts`, `roles.test.ts`, `users.test.ts`), all passing via Jest + Supertest against `mongodb-memory-server`:

- Permissions: unauthenticated rejection, create + duplicate-name (409), invalid-name-format (400), list/paginate/filter, update, delete-with-cascade-into-roles, 404/400 on missing/malformed id.
- Roles: unauthenticated rejection, create-with-attached-permissions, unknown-permission-id (400), duplicate-name (409), get-with-populated-permissions, update, delete-with-cascade-into-users.
- Users: unauthenticated rejection, list-with-pagination-meta, filter by search/isActive, get-with-populated-roles, update (name/isActive/roles) with unknown-role-id (400), delete-with-session-revocation.

Additionally live-smoke-tested the real HTTP server (not just Jest/supertest in-process) against a standalone in-memory MongoDB with real `curl` requests: full create-permission → create-role (attached) → assign-role-to-user → list/filter/paginate → delete-role (confirmed cascade into the user) → delete-permission → delete-user → confirmed revoked refresh token on a *different* user, end to end. Temp smoke script deleted afterward; nothing from it remains in the repo.

Verified clean: `npm run build` (strict TS), `npm run lint` (ESLint), `npm test` (27/27).

## Notable decisions (worth knowing before touching this code)

- **No permission checks yet.** Every endpoint in this phase is wide open to any authenticated user. This is intentional per the master doc's phase separation (Authorization Middleware is Phase 3) — don't "fix" this without also building Phase 3's permission-resolution logic; it's not an oversight to patch in isolation.
- **List endpoints don't populate references** (`GET /users` returns `roles` as raw ids, `GET /roles` doesn't need to since it has no further refs) — only single-resource `GET /:id` populates, to avoid needless join cost on list views. `GET /users/:id` populates two levels deep (`roles`, and each role's `permissions`).
- **PATCH replaces arrays wholesale**, not merge/append — sending `roles: [x]` on a user that already had `[y]` results in `[x]`, not `[x, y]`. Matches typical REST PATCH semantics for this kind of admin UI and keeps the service logic simple.
- **Unknown reference ids are a 400, not silently ignored** — creating/updating a Role with a nonexistent permission id, or a User with a nonexistent role id, fails loudly rather than silently dropping the bad reference.

## Remaining work (next phases)

- Phase 3: Authorization middleware that resolves permissions from a user's roles and actually guards these routes (never checking `role === "Admin"` directly — always evaluate the resolved permission set).
- Phase 4: First protected frontend client.
- Phase 5: Audit Log query/viewing API and UI.
- No seed data — there's no default "Admin" role or bootstrap permission set yet. Every environment starts empty and permissions/roles must be created via the API. Worth reconsidering once Phase 3 needs *something* to grant initial admin access.
