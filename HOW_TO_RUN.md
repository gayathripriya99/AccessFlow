# How to run AccessFlow, and what to check

Covers `backend/` (API) and `frontend-react/` (UI) — the only two runnable pieces as of Phase 9. See [README.md](README.md) for the phase table and `backend/Phase-XX.md` for what each phase actually built.

## 1. Prerequisites

- Node.js >= 18
- A reachable MongoDB instance — local `mongod`, Docker, or Atlas. Not needed for `npm test` (both backend test suite and this doc's manual checks against a real DB are separate — see step 4).

## 2. Backend setup

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — point at your MongoDB (default assumes local `mongodb://localhost:27017/accessflow`).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — replace both placeholder values with distinct long random strings (any local dev value works, just don't reuse one across the two).
- Leave the rest at their defaults unless you know you need to change them.

```bash
npm install
npm run dev
```

Should log a successful MongoDB connection and start listening on `http://localhost:4000` (or your `PORT`). Confirm with:

```bash
curl http://localhost:4000/api/v1/health
```

Expect a `200` with a JSON body.

## 3. Frontend setup

In a second terminal:

```bash
cd frontend-react
cp .env.example .env
npm install
npm run dev
```

Starts on `http://localhost:5173`. `VITE_API_BASE_URL` in `.env` must match the backend's actual address/port — the default (`http://localhost:4000/api/v1`) matches the backend's own default, so if you changed the backend's `PORT`, update this too.

Open `http://localhost:5173` in a browser — should redirect to `/login`.

## 4. What to check (manual smoke test)

Registration is now org-based (Phase 9) — the first thing to do is create an organization, not just a user.

1. **Register a new org.** On `/register`, choose "create a new organization," fill in your name/email/password, an org name (e.g. "Acme Corp"), and an org slug (e.g. `acme-corp`, lowercase letters/numbers/hyphens only). Submit, then log in on `/login` using that same email, password, and slug.
2. **Confirm admin bootstrap.** The first user in a brand-new org should land on the dashboard with full access — visit `/roles`, `/permissions`, `/users`, `/policies`, `/audit-logs`, and the Permission Simulator; none should 403. The Sidebar should show your org name above your name/roles.
3. **Register a second org with the same email.** Repeat step 1 with a different slug (e.g. `globex-inc`) but the *same* email/password. This should succeed — proves email uniqueness is per-org, not global (Phase 9). Logging in against `acme-corp`'s slug with `globex-inc`'s password (or vice versa) should fail with a generic invalid-credentials message.
4. **Join an existing org as a non-admin.** On `/register`, choose "join an existing organization," use a fresh email and one of the slugs from above. This user should land with **zero** roles/permissions — every nav item requiring a permission should be hidden, and directly navigating to e.g. `/users` should show a 403 `Forbidden` page.
5. **Grant a permission and confirm it takes effect.** As the admin from step 2, go to `/roles`, create or edit a role to include a permission (or just grant the non-admin user a role via `/users`), then have that user refresh — the previously-403 page should now work without them logging out/in again.
6. **Confirm tenant isolation.** As the `acme-corp` admin, check `/users` — it should list only Acme Corp's users, never Globex Inc's, even though both share your email address across the two orgs.
7. **Spot-check ABAC (Phase 8).** As any logged-in non-admin user (no `users.update`), open your own profile and rename yourself — should succeed. Try to change your own `isActive` flag or grant yourself a role via the same form — should be rejected (403), even though the rename worked.
8. **Spot-check role hierarchy (Phase 7), if you set one up in step 5.** A role with a parent should show the parent's permissions folded into "effective permissions" on the role's detail view, and a user holding only the child role should pass permission checks that only the parent role grants.
9. **Check the audit log.** `/audit-logs` (needs `auditlogs.read`) should show entries for every register/login/update above, newest first, with the acting user populated to a name/email — not just an id.
10. **i18n check.** Use the language switcher (usually in the Navbar) to switch to Hindi/Kannada/French and confirm the UI text changes — a quick way to catch a missed translation key.

If all ten pass, the app is working end-to-end for everything built through Phase 9.

## 5. Automated checks

```bash
cd backend
npm run build   # tsc strict type-check
npm run lint
npm test         # Jest + Supertest, in-memory MongoDB — no real DB needed, ~73 tests
```

```bash
cd frontend-react
npm run build   # tsc -b && vite build
npm run lint
```

All four should be clean before considering any change done. (Frontend has no automated test files yet — `npm test` there runs Vitest but currently has nothing to collect; the manual checklist in step 4 is the real coverage today.)

Single backend test file: `npx jest tests/<file>.test.ts --runInBand` (e.g. `auth.test.ts`, `tenant-isolation.test.ts`, `roles.test.ts`).

## 6. Troubleshooting

- **`MONGO_URI` connection errors on `npm run dev`** — confirm MongoDB is actually running and reachable at that URI; the backend throws at startup (env validation) if required vars are missing entirely, but a bad-but-present URI fails later at connection time.
- **401s that won't go away after registering** — check the frontend's `VITE_API_BASE_URL` actually points at the running backend; a silent CORS/URL mismatch looks like an auth failure in the UI.
- **Auth rate-limit errors during repeated manual testing** — `/register`/`/login`/`/refresh` are rate-limited (`AUTH_RATE_LIMIT_*` in `.env`); restart the backend or wait out the window if you hit it while testing repeatedly.
- **Port already in use** — find the real PID holding it (`netstat -ano | findstr LISTENING` on Windows) rather than guessing; a leftover dev server from a previous session is the usual cause.
