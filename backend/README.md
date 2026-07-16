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

Cross-cutting: `src/config` (env, DB connection, logger), `src/middlewares` (error handling, validation, rate limiting, auth guard), `src/utils` (JWT helpers, `ApiError`, cookie helpers), `src/validators` (Zod request schemas).

## API summary

All responses are JSON, wrapped as `{ "data": ... }` (list endpoints add `"meta"`) on success or `{ "error": { code, message, details? } }` on failure. **Every endpoint below except `/auth/*` and `/health` requires `Authorization: Bearer <accessToken>`.** None of them check *permissions* yet — that's Phase 3; right now any authenticated user can manage any resource. This is a deliberate, documented gap, not an oversight.

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

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create. Body: `name` (lowercase, e.g. `"users.read"`), `description`. 409 on duplicate name. |
| GET | `/?page=&limit=&search=` | Paginated list (default page 1 / limit 20, max limit 100), `search` matches `name` (case-insensitive substring). |
| GET | `/:id` | Get one. 404 if missing. |
| PATCH | `/:id` | Update `name`/`description`. |
| DELETE | `/:id` | Delete. Cascades: removed from every `Role.permissions` that referenced it. |

### `/api/v1/roles`

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create. Body: `name`, `description`, optional `permissions: [permissionId]` (each id must already exist — 400 on an unknown id). |
| GET | `/?page=&limit=&search=` | Paginated list, `search` on `name`. |
| GET | `/:id` | Get one, with `permissions` populated to full objects. |
| PATCH | `/:id` | Update `name`/`description`/`permissions` (full replace of the array, not a merge). |
| DELETE | `/:id` | Delete. Cascades: removed from every `User.roles` that referenced it. |

### `/api/v1/users`

No `POST /` — user creation stays at `/auth/register` (not duplicated here).

| Method | Path | Description |
|---|---|---|
| GET | `/?page=&limit=&search=&isActive=` | Paginated list, `search` matches `email` or `name`, `isActive` is `true`/`false`. Roles are **not** populated in list results (ids only) for performance. |
| GET | `/:id` | Get one, with `roles` populated (and each role's `permissions` populated in turn). |
| PATCH | `/:id` | Update `name`/`isActive`/`roles` (full replace of the roles array; each id must exist — 400 on an unknown id). |
| DELETE | `/:id` | Hard-deletes the user and revokes all of their refresh tokens (any active session is immediately logged out). |

All mutating actions on these three resources write an audit log entry (see Database section) recording which authenticated user performed the change.

## Database

- **users** — `email` (unique), `passwordHash` (bcrypt, `select: false`), `name`, `isActive`, `roles` (`ObjectId[]` ref `Role` — reserved since Phase 1, wired up for real in Phase 2), timestamps.
- **refreshtokens** — `userId`, `tokenHash` (SHA-256 of the signed JWT), `expiresAt` (TTL-indexed — Mongo auto-purges expired docs), `revokedAt`, `replacedByToken`.
- **auditlogs** — `userId` (the actor, not necessarily the affected resource), `action` (auth.\* from Phase 1, plus `permission.create/update/delete`, `role.create/update/delete`, `user.update/delete` from Phase 2), `ip`, `userAgent`, `metadata`, `createdAt`. A query/viewing API for this data is still Phase 5 — this and the prior phase only write entries.
- **permissions** *(new)* — `name` (unique, lowercase, e.g. `"users.read"`), `description`, timestamps.
- **roles** *(new)* — `name` (unique, lowercase), `description`, `permissions` (`ObjectId[]` ref `Permission`), timestamps.

All three resource schemas (`User`, `Permission`, `Role`) share a `toJSON` transform (`src/models/schemaOptions.ts`) that exposes `id` instead of Mongo's `_id`/`__v`, including on populated sub-documents.

## Tests

`npm test` runs 27 tests across four suites (`auth`, `permissions`, `roles`, `users`) via Jest + Supertest against an in-memory MongoDB (`mongodb-memory-server`) — no external database needed. Phase 2 coverage: full CRUD happy paths for all three resources, duplicate-name (409) and unknown-reference (400) validation, not-found (404) and malformed-id (400) handling, pagination/filtering, and both cascade behaviors (role delete → pulled from users; permission delete → pulled from roles) plus session revocation on user delete.

See [Phase-01.md](Phase-01.md) and [Phase-02.md](Phase-02.md) for end-of-phase summaries.
