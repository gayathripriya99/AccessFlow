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

## API summary — `/api/v1/auth`

All responses are JSON, wrapped as `{ "data": ... }` on success or `{ "error": { code, message, details? } }` on failure.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Create a user. Body: `email`, `password` (min 8, needs upper/lower/digit), `name`. Returns the public user (no tokens — call `/login` next). |
| POST | `/login` | — | Verify credentials. Returns `{ user, accessToken }` and sets an httpOnly `accessflow_refresh_token` cookie (scoped to `/api/v1/auth`). |
| POST | `/refresh` | refresh cookie | Rotates the refresh token (old one is invalidated), returns a new `accessToken` and sets the new cookie. Reusing an already-rotated token revokes the entire session and returns 401 (reuse detection). |
| POST | `/logout` | refresh cookie | Revokes the refresh token and clears the cookie. Idempotent. |
| GET | `/me` | `Authorization: Bearer <accessToken>` | Returns the authenticated user. This only proves identity — it does not check permissions (that's Phase 3). |
| GET | `/api/v1/health` | — | Liveness check. |

Rate limiting (`express-rate-limit`) applies to `/register` and `/login`/`/refresh` per `AUTH_RATE_LIMIT_*` env vars.

## Database

Collections introduced this phase:

- **users** — `email` (unique), `passwordHash` (bcrypt, `select: false`), `name`, `isActive`, `roles` (reserved `ObjectId[]`, unused until Phase 2), timestamps.
- **refreshtokens** — `userId`, `tokenHash` (SHA-256 of the signed JWT), `expiresAt` (TTL-indexed — Mongo auto-purges expired docs), `revokedAt`, `replacedByToken`.
- **auditlogs** — `userId`, `action` (`auth.register` / `auth.login.success` / `auth.login.failure` / `auth.refresh` / `auth.refresh.reuse_detected` / `auth.logout`), `ip`, `userAgent`, `metadata`, `createdAt`. A query/viewing API for this data is Phase 5 — this phase only writes entries.

## Tests

`npm test` runs the full register → login → refresh (rotation + reuse-detection) → logout flow against an in-memory MongoDB via `mongodb-memory-server`, plus validation/duplicate-email/bad-password edge cases. No external database required to run the suite.

See [Phase-01.md](Phase-01.md) for the end-of-phase summary.
