# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**AccessFlow** — a portfolio-quality, production-grade Enterprise IAM/RBAC platform. Master spec: [doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md](doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md). That file lists a planned 14-document suite (`01_PRODUCT_REQUIREMENTS.md` through `14_INTERVIEW_PREPARATION.md`) — as of now **only doc `00` exists**; the rest haven't been authored yet, so don't assume specs beyond what `00` states and what's already built. (The original, more detailed `doc_files/` folder — including the GitHub/deployment conventions doc — was replaced by this condensed version outside of any Claude session; its content is no longer in the repo, only summarized in `chatdocument_doc_file/`.)

Progress is tracked per-phase in `backend/Phase-XX.md` files and in the root [README.md](README.md) phase table. **Phases 1 (Authentication), 2 (Users/Roles/Permissions CRUD), 3 (Authorization Middleware), 4 (Protected UI — React), and 5 (Audit Logs) are complete.** Read the most recent `Phase-XX.md` before starting new work to know exactly what exists. The repo is pushed to `github.com/gayathripriya99/AccessFlow` (`main` branch) via a dedicated repo-local git identity/SSH key — see `chatdocument_doc_file/` for the exact setup history if that ever needs revisiting.

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

Single test file: `npx jest tests/auth.test.ts --runInBand` (also `permissions.test.ts`, `roles.test.ts`, `users.test.ts`). Env vars for `npm run dev`/`start` come from `backend/.env` (copy from `.env.example`); tests get their own env via `tests/env.setup.ts` and never touch `.env`.

## Repository layout

`backend/` (the API) and `frontend-react/` (Phase 4's protected UI) both exist now. `frontend-angular/`, `frontend-vue/`, `frontend-nextjs/` are still intentionally not created — the master doc's phase ordering only required one frontend client to reach Phase 4; don't scaffold the others without confirming they're actually wanted.

`frontend-react/` layering: `src/api/*` (axios client + one file per resource — `auth`/`users`/`roles`/`permissions`/`auditLogs` — plus shared `types.ts`/`errors.ts`), `src/auth/*` (`AuthContext` — in-memory access token + silent-refresh-on-mount, tracks `sessionExpired` separately from a plain logged-out state, `ProtectedRoute` — redirects unauthenticated to `/login`, `PermissionGate` — hides inline elements, `RequirePermission` — route-level guard rendering `Forbidden`), `src/pages/*` (one per route: `LoginPage`, `RegisterPage`, `DashboardPage`, `UsersPage`, `RolesPage`, `PermissionsPage`, `AuditLogsPage`, `NotFoundPage`), `src/components/*` (generic, reused across pages — `DataTable`, `Pagination`, `SearchInput`, `FormField`, `Button`, `Layout`, `Navbar`, `Sidebar`, `Forbidden`, `ErrorState`, `LanguageSwitcher`), `src/config/navigation.ts` (single `NAV_ITEMS` source Sidebar + Navbar's mobile drawer both render from, permission-filtered), `src/i18n/*` (4 locales: en/hi/kn/fr). See `backend/Phase-04.md` and `backend/Phase-05.md` for the full rundown.

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
- `src/middlewares/*` — `errorHandler`/`notFoundHandler` (centralized JSON error shape via `ApiError`), `validateRequest` (Zod), `rateLimiter`, `validateObjectIdParam` (rejects malformed `:id` params with 400 before hitting the service), `requireAuth` (verifies bearer JWT, populates `req.auth` — authentication only, proves identity), `requirePermission(name)` (Phase 3 — resolves the caller's effective permissions and 403s if missing; always runs after `requireAuth`).
- `src/utils/*` — `ApiError`, `asyncHandler`, JWT sign/verify (`jwt.ts`), refresh-token hashing (`hashToken.ts`, SHA-256 — deliberately not bcrypt since refresh tokens are already high-entropy), cookie helpers, `pagination.ts` (shared `parsePagination`/`buildPaginationMeta` used by every list endpoint), `objectId.ts` (`isValidObjectId`, `toObjectIdArray`).
- `src/constants/systemPermissions.ts` — the 12 baseline permissions + `admin` role name used by first-user bootstrap (see below).

New feature work should follow this exact layering — don't put logic in controllers or routes.

## RBAC rules (enforced since Phase 3)

- Permissions are the source of truth. Users may have multiple roles (`User.roles: ObjectId[]`, `src/models/User.ts`); roles bundle permissions (`Role.permissions: ObjectId[]`, `src/models/Role.ts`).
- **Never** check `role === "Admin"` directly anywhere in authorization logic — always resolve and evaluate the permission set, frontend included (the React app gates on `permissions: string[]` from `/auth/me`, never on role name). `AuthorizationService.resolveAccess(userId)` is the one place this resolution happens (populates `roles` → `roles.permissions`, returns both role names and the flattened permission-name set in one query); `getPermissionNames(userId)` is a thin wrapper around it kept for `requirePermission(name)`. `AuthService.getCurrentUser` (backing `GET /auth/me`) also calls `resolveAccess` directly, since Phase 4 — the frontend needs both role names (for display) and permissions (for gating), not just identity.
- `/api/v1/permissions`, `/api/v1/roles`, `/api/v1/users` (`src/routes/v1/{permission,role,user}.routes.ts`) are now genuinely permission-gated, one `requirePermission('<resource>.<action>')` per route — see `backend/Phase-03.md` for the full permission-to-route mapping.
- **Admin bootstrap:** the very first user ever registered (`UserRepository.count() === 1` at that moment) automatically gets an `admin` role with all 12 baseline permissions, via `AdminBootstrapService.bootstrapFirstUserAsAdmin`, called from `AuthService.register`. Every later registration gets zero roles — access must be granted explicitly via `PATCH /users/:id`. This also means the first `createAuthenticatedUser()` call in any test file becomes that test's admin (each test's in-memory DB is cleared beforehand); tests needing a guaranteed non-admin user should use `createNonAdminUser` from `tests/helpers/authenticatedUser.ts` instead.
- Deleting a `Permission`/`Role` cascades: it's pulled out of every `Role`/`User` that referenced it (see `PermissionRepository.deleteById`/`RoleRepository.deleteById`). Deleting a `User` revokes all their refresh tokens. Deactivating (`isActive: false`) or deleting a user also immediately zeroes out their effective permissions on their next request, even on an unexpired access token — `AuthorizationService` checks `isActive`, not just JWT validity.

## Auth/session design notes (non-obvious, worth knowing before touching this code)

- Refresh tokens are signed JWTs (`{ sub, jti }`) *and* their SHA-256 hash is stored server-side in the `refreshtokens` collection, keyed by `jti` (== the document `_id`, pre-generated before signing so the two match — see `AuthService.issueTokenPair`). This lets refresh tokens be revoked/rotated server-side despite being stateless JWTs.
- Refresh token rotation includes reuse detection: presenting an already-rotated-out (revoked) token revokes **all** active refresh tokens for that user (treats the session as compromised), not just the one presented.
- The refresh token is delivered only via an httpOnly cookie scoped to `path: /api/v1/auth` — never returned in a JSON body.
- `refreshtokens.expiresAt` has a Mongo TTL index (`expireAfterSeconds: 0`) — expired docs are auto-purged, no cron needed.
- Audit logging (`AuditLog` model/`AuditLogRepository`) writes auth events (register/login success+failure/refresh/reuse-detected/logout) and Permission/Role/User mutation events. **Phase 5** added the query/viewing side: `GET /api/v1/audit-logs` (gated on `auditlogs.read`), filterable by `action`/`userId`/`from`/`to`, sorted newest-first (unlike Permission/Role's alphabetical lists), with `userId` always populated to `{id, name, email}` since showing *who* did something is the point of this view (unlike Role/User's deliberately-unpopulated lists — see `backend/Phase-05.md`).
- `User`, `Permission`, `Role`, and `AuditLog` schemas all set `toJSON: toJSONOptions` (`src/models/schemaOptions.ts`) so API responses expose `id` instead of Mongo's `_id`/`__v` — Mongoose does **not** do this by default (its `id` virtual isn't included in `toJSON()` output unless configured). If you add a new model whose raw documents get serialized directly to a client, apply the same option or you'll silently leak `_id` instead of `id`.
- **A `Schema.Types.Mixed` field defaulting to `{}` isn't actually persisted as `{}`** unless the schema sets `minimize: false` — Mongoose's default `minimize: true` strips empty-object fields before saving. `AuditLog.metadata` hit this: most actions never pass explicit metadata, so those documents were missing the field entirely (not `{}`), which crashed the frontend's `Object.keys(row.metadata)` the first time this was actually exercised in a browser. Fixed with `minimize: false` on that schema; the frontend still treats `metadata` as possibly absent (`row.metadata &&`) since it's reading across an API boundary. Worth remembering for any future `Mixed`-typed field with an object default.

## GitHub/deployment conventions

The dedicated-SSH-identity/deployment guide that originally lived at `doc_files/12_GITHUB_DEPLOYMENT_MASTER_GUIDE.md` has been removed from the repo (superseded by the new `doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md`, which lists a forthcoming `10_GITHUB_SETUP.md`/`11_RENDER_VERCEL_ATLAS.md` in its planned doc suite — neither exists yet). Until those are authored, the applicable rules are recorded in `chatdocument_doc_file/` (the exact SSH host alias, repo-local git identity, and remote already set up for this repo) and the general hard rules still apply regardless of which doc states them: never request/store passwords, private keys, or PATs, and always pause for explicit confirmation before any action that touches the user's accounts or local machine credentials.

## Cross-cutting requirements (apply to all frontend work, Phase 4+)

- i18n: no hardcoded UI text — translation files only (English, Hindi, Kannada, French). `frontend-react/src/i18n/locales/*.json` — add a key to all 4 files together, never just `en.json` (i18next falls back to `en` for missing keys, but that's a stopgap, not a substitute for translating).
- Responsive breakpoints: 320, 375, 425, 768, 1024, 1280, 1440, 1920+ — configured as Tailwind's `--breakpoint-*` theme variables in `frontend-react/src/index.css`, replacing Tailwind's defaults entirely.
- Every completed feature needs a README update, API summary, DB-change notes, and a `Phase-XX.md` end-of-chat summary (see `backend/Phase-01.md` for the format).
- The new master doc adds two goals not in the original spec: a **"Modern AI Chatbot module"** and explicit **MongoDB Atlas** (vs. generic MongoDB) — neither has been scoped into a phase yet. Flag this to the user before assuming which phase should absorb them.
