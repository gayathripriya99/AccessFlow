# Phase 01 — Authentication

## Objectives completed

- Backend project scaffolded (TypeScript, Express, Mongoose, clean layered architecture per `routes → controllers → services → repositories → MongoDB`).
- Full authentication flow: register, login, refresh (with rotation + reuse detection), logout, and an authenticated `/me` endpoint.
- JWT access tokens (short-lived) + rotating refresh tokens (long-lived, httpOnly cookie, hashed at rest, TTL-indexed for automatic cleanup).
- bcrypt password hashing (12 salt rounds).
- Security baseline: Helmet secure headers, CORS allowlist via env, rate limiting on auth routes, centralized error handling, Zod input validation on every route.
- Structured logging (pino) + request logging (morgan), all config via environment variables (`.env.example` committed).
- Minimal audit logging of auth events (register/login success+failure/refresh/refresh-reuse-detected/logout) — the full Audit Log query/viewing module is deferred to Phase 5 as scoped.
- API versioned at `/api/v1`.
- Root repo scaffolding: git initialized, root README with phase-status table, `.gitignore`.

## Files created

```
RBAC_Project/
├── .gitignore
├── README.md
└── backend/
    ├── package.json, tsconfig.json, .eslintrc.json, .prettierrc.json, jest.config.js
    ├── .env.example, .env, .gitignore
    ├── README.md, Phase-01.md
    ├── src/
    │   ├── config/       env.ts, logger.ts, database.ts
    │   ├── models/       User.ts, RefreshToken.ts, AuditLog.ts
    │   ├── repositories/ UserRepository.ts, RefreshTokenRepository.ts, AuditLogRepository.ts
    │   ├── services/     AuthService.ts
    │   ├── controllers/  AuthController.ts
    │   ├── routes/v1/    auth.routes.ts, health.routes.ts, index.ts
    │   ├── middlewares/  errorHandler.ts, validateRequest.ts, rateLimiter.ts, requireAuth.ts
    │   ├── validators/   auth.validators.ts
    │   ├── utils/        ApiError.ts, asyncHandler.ts, jwt.ts, hashToken.ts, cookies.ts
    │   ├── app.ts, server.ts
    └── tests/
        ├── env.setup.ts, setup.ts
        └── auth.test.ts
```

## APIs added

All under `/api/v1`:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me` (bearer-authenticated)
- `GET /health`

Full request/response shapes documented in [backend/README.md](README.md#api-summary--apiv1auth).

## Database changes

New collections: `users`, `refreshtokens` (TTL-indexed on `expiresAt`), `auditlogs`. Schema details in [backend/README.md](README.md#database).

## Components

Backend only this phase (no frontend clients yet — per the master doc's phase ordering, frontend work starts at Phase 4 / Protected UI).

## Tests

`tests/auth.test.ts` — 9 integration tests via Jest + Supertest against `mongodb-memory-server`:
- register: success (no passwordHash leaked), duplicate email → 409, weak password → 400
- login: wrong password → 401, success issues accessToken + refresh cookie
- `/me`: 401 without token, 200 with valid token
- refresh: rotates token and rejects reuse of the rotated-out token with 401
- logout: revokes the refresh token; a subsequent refresh attempt returns 401

All passing. Additionally smoke-tested the real HTTP server (not just in-process supertest) against an in-memory MongoDB with live `curl` requests, confirming security headers, rate-limit headers, cookie rotation, and the post-logout/reuse rejection paths all behave correctly end-to-end.

Verified clean: `npm run build` (strict TS), `npm run lint` (ESLint), `npm test`.

## Remaining work (next phases)

- Phase 2: Roles & Permissions collections, Users/Roles/Permissions CRUD APIs, wiring the reserved `User.roles` field.
- Phase 3: Authorization middleware that resolves permissions from roles (never checking `role === "Admin"` directly) and guards routes.
- Phase 4: First protected frontend client (Protected UI) — frontend folders intentionally not created yet.
- Phase 5: Audit Log query/viewing API and UI (write path already exists from this phase).
- i18n, responsive breakpoints, and the remaining cross-cutting requirements apply once frontend work begins in Phase 4.
