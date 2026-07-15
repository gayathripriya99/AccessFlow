# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**AccessFlow** — a portfolio-quality, production-grade Enterprise IAM/RBAC platform. Full spec: [doc_files/00_AI_MASTER_INSTRUCTIONS_AccessFlow.md](doc_files/00_AI_MASTER_INSTRUCTIONS_AccessFlow.md). Deployment/repo conventions: [doc_files/12_GITHUB_DEPLOYMENT_MASTER_GUIDE.md](doc_files/12_GITHUB_DEPLOYMENT_MASTER_GUIDE.md). Read both before starting work — the summaries below are not substitutes.

Progress is tracked per-phase in `backend/Phase-XX.md` files and in the root [README.md](README.md) phase table. **Phase 1 (Authentication) is complete.** Read the most recent `Phase-XX.md` before starting new work to know exactly what exists.

## Commands (run from `backend/`)

```bash
npm install
npm run dev        # hot-reload dev server (tsx watch), needs MONGO_URI reachable
npm run build       # tsc strict type-check + compile to dist/
npm start           # run compiled dist/server.js
npm run lint        # ESLint over src/ and tests/
npm run lint:fix
npm test            # Jest + Supertest, in-memory MongoDB (mongodb-memory-server) — no external DB needed
npm run test:watch
```

Single test file: `npx jest tests/auth.test.ts --runInBand`. Env vars for `npm run dev`/`start` come from `backend/.env` (copy from `.env.example`); tests get their own env via `tests/env.setup.ts` and never touch `.env`.

## Repository layout

Only `backend/` exists so far. Frontend folders (`frontend-react/`, `frontend-angular/`, `frontend-vue/`, `frontend-nextjs/`) are intentionally not created yet — per the master doc's phase ordering, frontend work starts at Phase 4 ("Protected UI"). Don't scaffold them early.

## Backend architecture (strict layering)

```
routes → controllers → services → repositories → MongoDB (Mongoose models)
```

- `src/routes/v1/*` — path + middleware + controller method wiring only.
- `src/controllers/*` — HTTP only (parse request, call service, shape response). No business logic.
- `src/services/*` — business logic lives here (e.g. `AuthService`: hashing, token issuance/rotation, audit decisions).
- `src/repositories/*` — the only layer allowed to touch Mongoose models directly.
- `src/models/*` — Mongoose schemas.
- `src/config/*` — env loader (`env.ts`, throws on missing required vars at import time), DB connection, pino logger.
- `src/middlewares/*` — `errorHandler`/`notFoundHandler` (centralized JSON error shape via `ApiError`), `validateRequest` (Zod), `rateLimiter`, `requireAuth` (verifies bearer JWT, populates `req.auth` — this is authentication only, **not** authorization/permission-checking, which is Phase 3).
- `src/utils/*` — `ApiError`, `asyncHandler`, JWT sign/verify (`jwt.ts`), refresh-token hashing (`hashToken.ts`, SHA-256 — deliberately not bcrypt since refresh tokens are already high-entropy), cookie helpers.

New feature work should follow this exact layering — don't put logic in controllers or routes.

## RBAC rules (apply from Phase 2 onward, keep in mind now)

- Permissions are the source of truth. Users may have multiple roles; roles bundle permissions.
- **Never** check `role === "Admin"` directly anywhere in authorization logic — always resolve and evaluate the permission set.
- `User.roles` (`src/models/User.ts`) is a reserved `ObjectId[]` field, currently unused — the `Role` collection doesn't exist until Phase 2.

## Auth/session design notes (non-obvious, worth knowing before touching this code)

- Refresh tokens are signed JWTs (`{ sub, jti }`) *and* their SHA-256 hash is stored server-side in the `refreshtokens` collection, keyed by `jti` (== the document `_id`, pre-generated before signing so the two match — see `AuthService.issueTokenPair`). This lets refresh tokens be revoked/rotated server-side despite being stateless JWTs.
- Refresh token rotation includes reuse detection: presenting an already-rotated-out (revoked) token revokes **all** active refresh tokens for that user (treats the session as compromised), not just the one presented.
- The refresh token is delivered only via an httpOnly cookie scoped to `path: /api/v1/auth` — never returned in a JSON body.
- `refreshtokens.expiresAt` has a Mongo TTL index (`expireAfterSeconds: 0`) — expired docs are auto-purged, no cron needed.
- Audit logging (`AuditLog` model/`AuditLogRepository`) already writes auth events (register/login success+failure/refresh/reuse-detected/logout) this phase, but there's no query/viewing API yet — that's Phase 5's job. Don't build the audit *viewer* prematurely.

## GitHub/deployment conventions

Before pushing to GitHub or touching deployment (Vercel/Render/MongoDB Atlas/GitHub Actions), re-read [doc_files/12_GITHUB_DEPLOYMENT_MASTER_GUIDE.md](doc_files/12_GITHUB_DEPLOYMENT_MASTER_GUIDE.md) in full — it specifies a dedicated GitHub account/SSH identity for this repo (must not overwrite any existing global git/SSH config), the target repo name/structure, and hard rules: never request/store passwords, private keys, or PATs, and always pause for explicit confirmation before any action that touches the user's accounts or local machine credentials.

## Cross-cutting requirements (apply once frontend work starts, Phase 4+)

- i18n: no hardcoded UI text — translation files only (English, Hindi, Kannada, French).
- Responsive breakpoints: 320, 375, 425, 768, 1024, 1280, 1440, 1920+.
- Every completed feature needs a README update, API summary, DB-change notes, and a `Phase-XX.md` end-of-chat summary (see `backend/Phase-01.md` for the format).
