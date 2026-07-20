# AccessFlow Backend

Frontend-agnostic REST API for the AccessFlow IAM platform. Node.js + Express + MongoDB (Mongoose), TypeScript, clean layered architecture.

## Stack

- Node.js / Express.js / TypeScript
- MongoDB / Mongoose
- JWT access tokens + rotating refresh tokens (bcrypt password hashing)
- Zod validation, Helmet, express-rate-limit, pino logging
- Jest + Supertest + mongodb-memory-server for tests

## Getting started

```bash
cp .env.example .env      # then fill in real secrets/URIs
npm install
npm run dev                # starts on http://localhost:4000 (or PORT from .env)
```

Requires a reachable MongoDB instance at `MONGO_URI` (local `mongod`, Docker, or Atlas).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm run build` | Type-check and compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm test` | Jest integration suite (in-memory MongoDB, no external DB needed) |

## Architecture

```
routes → controllers → services → repositories → MongoDB
```

- **routes** (`src/routes`) — wiring only: path, middleware, controller method.
- **controllers** (`src/controllers`) — HTTP concerns only (parse request, call service, shape response). No business logic.
- **services** (`src/services`) — business logic (password hashing, token issuance/rotation, audit logging decisions).
- **repositories** (`src/repositories`) — the only layer that talks to Mongoose models.
- **models** (`src/models`) — Mongoose schemas.

Cross-cutting: `src/config` (env, DB connection, logger), `src/middlewares` (error handling, validation, rate limiting, `requireAuth` identity guard, `requirePermission` permission guard, `requireAccess` ABAC-then-RBAC guard), `src/utils` (JWT helpers, `ApiError`, cookie helpers), `src/validators` (Zod request schemas), `src/constants` (the baseline permission/policy sets used by admin bootstrap).

## Authorization

Every endpoint below except `/auth/*` and `/health` requires `Authorization: Bearer <accessToken>` **and** the specific permission named in its table row — resolved from the caller's roles, never a hardcoded role-name check — **or** a matching ABAC `allow` policy where noted (Phase 8; a matching `deny` policy blocks the request regardless of permissions). Missing both returns `403`.

**Bootstrap:** the very first user ever registered (in an empty database) automatically gets an `admin` role bundling a baseline set of 17 permissions (all CRUD actions on permissions/roles/users/policies, plus `auditlogs.read` and `simulator.run` — see `src/constants/systemPermissions.ts`), so a fresh deployment isn't locked out of managing its own RBAC data. It also seeds 3 baseline ABAC policies (`src/constants/systemPolicies.ts`) — see the `/api/v1/policies` section below. Every subsequent registration gets zero roles/permissions and must be granted access by an existing admin via `PATCH /users/:id`.

## API summary

All responses are JSON, wrapped as `{ "data": ... }` (list endpoints add `"meta"`) on success or `{ "error": { code, message, details? } }` on failure.

### `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Create a user. Body: `email`, `password` (min 8, needs upper/lower/digit), `name`. Returns the public user (no tokens — call `/login` next). |
| POST | `/login` | — | Verify credentials. Returns `{ user, accessToken }` and sets an httpOnly `accessflow_refresh_token` cookie (scoped to `/api/v1/auth`). |
| POST | `/refresh` | refresh cookie | Rotates the refresh token (old one is invalidated), returns a new `accessToken` and sets the new cookie. Reusing an already-rotated token revokes the entire session and returns 401 (reuse detection). |
| POST | `/logout` | refresh cookie | Revokes the refresh token and clears the cookie. Idempotent. |
| GET | `/me` | bearer | Returns the authenticated user. |
| GET | `/api/v1/health` | — | Liveness check. |

Rate limiting (`express-rate-limit`) applies to `/register` and `/login`/`/refresh` per `AUTH_RATE_LIMIT_*` env vars.

### `/api/v1/permissions`

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/` | `permissions.create` | Create. Body: `name` (lowercase, e.g. `"users.read"`), `description`. 409 on duplicate name. |
| GET | `/?page=&limit=&search=` | `permissions.read` | Paginated list (default page 1 / limit 20, max limit 100), `search` matches `name` (case-insensitive substring). |
| GET | `/:id` | `permissions.read` | Get one. 404 if missing. |
| PATCH | `/:id` | `permissions.update` | Update `name`/`description`. |
| DELETE | `/:id` | `permissions.delete` | Delete. Cascades: removed from every `Role.permissions` that referenced it. |

### `/api/v1/roles`

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/` | `roles.create` | Create. Body: `name`, `description`, optional `permissions: [permissionId]` (each id must already exist — 400 on an unknown id), optional `parentRoleId` (a role id, or `null`/omitted for no parent — 400 if it doesn't exist). |
| GET | `/?page=&limit=&search=` | `roles.read` | Paginated list, `search` on `name`. List rows do **not** include `parentRole`/`effectivePermissions`/`ancestorNames` — detail-view only, same as `permissions` itself. |
| GET | `/:id` | `roles.read` | Get one, with `permissions` populated to full objects, `parentRole` populated to `{id, name}` (or `null`), plus two Phase-7 computed fields: `effectivePermissions` (own + every ancestor's permission names, deduped) and `ancestorNames` (the chain from immediate parent to root). |
| PATCH | `/:id` | `roles.update` | Update `name`/`description`/`permissions` (full replace of the array, not a merge) / `parentRoleId` (a role id to set it, `null` to explicitly clear it, or omit to leave unchanged — sending `""` is invalid). 400 if the new parent doesn't exist, or if it would create a hierarchy cycle (self-parenting or a transitive loop). |
| DELETE | `/:id` | `roles.delete` | Delete. Cascades: removed from every `User.roles` that referenced it, and any child roles have `parentRole` nulled out (not left dangling). |

### `/api/v1/users`

No `POST /` — user creation stays at `/auth/register` (not duplicated here, and not permission-gated). The three single-resource routes below are gated by `requireAccess` (Phase 8), not `requirePermission` directly — ABAC policies are checked first, the listed permission is the *fallback* used only when no policy matches. `GET /` (list) has no single resource id to evaluate a policy against, so it stays permission-gated only.

| Method | Path | Permission (fallback) | Description |
|---|---|---|---|
| GET | `/?page=&limit=&search=&isActive=` | `users.read` | Paginated list, `search` matches `email` or `name`, `isActive` is `true`/`false`. Roles are **not** populated in list results (ids only) for performance. |
| GET | `/:id` | `users.read` | Get one, with `roles` populated (and each role's `permissions` populated in turn). The seeded `self-service-read` policy lets any caller fetch **their own** record here even without `users.read`. |
| PATCH | `/:id` | `users.update` | Update `name`/`isActive`/`roles` (full replace of the roles array; each id must exist — 400 on an unknown id). The seeded `self-service-update` policy lets any caller update their own record without `users.update` — but `UserService` restricts that specific path to the `name` field only; attempting `roles`/`isActive` without real `users.update` is 403, even on your own record. This is how an admin grants access to *other* users. |
| DELETE | `/:id` | `users.delete` | Hard-deletes the user and revokes all of their refresh tokens (any active session is immediately logged out). The seeded `deny-self-delete` policy blocks a caller from deleting **their own** account here even if they hold `users.delete` — an explicit deny always wins over an RBAC grant. |

All mutating actions on these three resources write an audit log entry (see Database section) recording which authenticated user performed the change.

### `/api/v1/audit-logs`

Read-only — no `POST`/`PATCH`/`DELETE`; entries are system-generated by the actions above, never created directly.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/?page=&limit=&action=&userId=&from=&to=` | `auditlogs.read` | Paginated list, sorted **newest-first**. `action` must be one of the known `AuditAction` values (400 otherwise); `userId` must be a valid ObjectId; `from`/`to` filter `createdAt` (any string `Date.parse` accepts). `userId` on each entry is populated to `{id, name, email}` (or `null` for events with no known actor, e.g. a login failure against a nonexistent email). |

### `/api/v1/simulator`

Diagnostic-only — never mutates anything, never actually grants a permission.

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/check` | `simulator.run` | Body is a discriminated union on `mode`: `{ mode: "user", userId, permission }` (404 if the user doesn't exist) or `{ mode: "roles", roleIds: [id, ...], permission }` (400 on any unknown role id, min 1 / max 20 ids). Returns `{ allowed, permission, roleNames, grantedByRoles, resolvedPermissions, userActive? }` — `userActive` is present (and forces `allowed: false` when `false`) only for `mode: "user"`; a hypothetical role selection has no user to be active or inactive. `permission` doesn't need to be a real `Permission` document — an invented name simply won't be in anyone's resolved set. **Does not evaluate ABAC policies** — Phase 8 explicitly didn't extend this to know about `resource.id`-scoped decisions; it's RBAC-only. |

### `/api/v1/policies`

ABAC (Phase 8) configuration — ordinary CRUD, not diagnostic-only like `/simulator`. `resource` is currently restricted to `"user"` and `action` to `"read"`/`"update"`/`"delete"` (the only ABAC-checked route group so far — see `/api/v1/users` above); widening either enum doesn't need a migration, just a validator change plus a new `requireAccess` call site.

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/` | `policies.create` | Create. Body: `name`, `description`, `resource`, `action`, `effect` (`"allow"`/`"deny"`), `conditions` (1–10 `{attribute, operator, compareTo}` objects, ANDed), optional `enabled` (default `true`). 409 on duplicate name. |
| GET | `/?page=&limit=&search=` | `policies.read` | Paginated list, `search` on `name`. |
| GET | `/:id` | `policies.read` | Get one. |
| PATCH | `/:id` | `policies.update` | Update any field; `conditions` is a full replace, not a merge. |
| DELETE | `/:id` | `policies.delete` | Delete. Any `requireAccess` call relying on this policy immediately falls back to its RBAC permission — no cascade needed since nothing else references a Policy by id. |

Each `condition`'s `attribute`/`compareTo` is a dot-path (`subject.id`, `resource.id`) or, for `compareTo`, a literal string — see `AbacService`'s doc comment for the exact resolution rules. Policy CRUD itself writes `policy.create`/`update`/`delete` audit log entries, same as Permissions/Roles/Users.

## Database

- **users** — `email` (unique), `passwordHash` (bcrypt, `select: false`), `name`, `isActive`, `roles` (`ObjectId[]` ref `Role` — reserved since Phase 1, wired up for real in Phase 2), timestamps.
- **refreshtokens** — `userId`, `tokenHash` (SHA-256 of the signed JWT), `expiresAt` (TTL-indexed — Mongo auto-purges expired docs), `revokedAt`, `replacedByToken`.
- **auditlogs** — `userId` (the actor, not necessarily the affected resource — `null` when unknown, e.g. a login failure against a nonexistent email), `action` (auth.\* from Phase 1, plus `permission.create/update/delete`, `role.create/update/delete`, `user.update/delete` from Phase 2), `ip`, `userAgent`, `metadata` (`{}` when nothing extra was recorded — the schema sets `minimize: false` so this is genuinely persisted, not stripped), `createdAt`. Queryable since Phase 5 via `GET /api/v1/audit-logs`.
- **permissions** — `name` (unique, lowercase, e.g. `"users.read"`), `description`, timestamps.
- **roles** — `name` (unique, lowercase), `description`, `permissions` (`ObjectId[]` ref `Permission`), `parentRole` (`ObjectId | null` ref `Role`, self-referencing — Phase 7 role hierarchy), timestamps.
- **policies** — `name` (unique, lowercase), `description`, `resource`, `action`, `effect` (`"allow"`/`"deny"`), `conditions` (embedded array, not a separate collection: `[{attribute, operator, compareTo}]`), `enabled`, timestamps. Phase 8.

`User`, `Permission`, `Role`, `AuditLog`, and `Policy` schemas all share a `toJSON` transform (`src/models/schemaOptions.ts`) that exposes `id` instead of Mongo's `_id`/`__v`, including on populated sub-documents.

`AuthorizationService.getPermissionNames()` resolves a user's effective permissions on every request by populating `User.roles` → `Role.permissions`, then (since Phase 7) walking each role's `parentRole` chain too, and flattening every name into a set (also treats a deactivated or since-deleted user as having zero permissions, closing a gap where a still-valid access JWT could otherwise bypass DB-side deactivation). Since Phase 8, `requireAccess` (used instead of `requirePermission` on the three single-resource Users routes) consults `AbacService`/`PolicyRepository` *before* falling back to this same permission resolution.

## Tests

`npm test` runs 63 tests across seven suites (`auth`, `permissions`, `roles`, `users`, `auditLog`, `simulator`, `policies`) via Jest + Supertest against an in-memory MongoDB (`mongodb-memory-server`) — no external database needed. Phase 3 adds one 403-on-missing-permission test per resource, using `tests/helpers/authenticatedUser.ts`'s `createNonAdminUser` (registers a throwaway first user to consume the admin-bootstrap slot, then returns a second, genuinely permission-less user). Phase 7's role-hierarchy tests live inside `roles.test.ts` (a `describe('Role hierarchy (Phase 7)', ...)` block) rather than a new file, since they extend the existing `Role` resource; Phase 8's ABAC integration tests (self-service read/update/delete, the field-restriction guard, live enabled/delete effects) live in `policies.test.ts` alongside the ordinary Policy-CRUD tests.

See [Phase-01.md](Phase-01.md) through [Phase-08.md](Phase-08.md) for end-of-phase summaries.
