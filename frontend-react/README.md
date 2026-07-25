# AccessFlow — React frontend

Protected UI for the AccessFlow IAM platform (Phase 4+), talking to the `backend/` API. React 19 + TypeScript + Vite, Tailwind CSS v4, permission-gated throughout — never a hardcoded role-name check (see [CLAUDE.md](../CLAUDE.md)'s RBAC rules).

## Stack

- React 19 + React Router 7 + Vite 8
- TanStack Query — server state (list pages, mutations, cache invalidation)
- React Hook Form + Zod — form state and validation
- Axios — API client, with a response interceptor handling silent access-token refresh
- react-i18next — 4 locales (English, Hindi, Kannada, French)
- Tailwind CSS v4 — custom breakpoints (see `src/index.css`, replaces Tailwind's defaults: 320/375/425/768/1024/1280/1440/1920+)
- oxlint (lint), Vitest + Testing Library + MSW (unit test tooling — see "Tests" below), Playwright (devDependency, used for manual/live verification scripts, not CI)

## Getting started

```bash
cp .env.example .env      # VITE_API_BASE_URL — must match the backend's actual address
npm install
npm run dev                # http://localhost:5173
```

Requires the backend (`../backend`) running and reachable at `VITE_API_BASE_URL`. See the root [HOW_TO_RUN.md](../HOW_TO_RUN.md) for the full two-server setup and a manual verification checklist.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b` type-check + `vite build` to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |
| `npm test` / `npm run test:watch` | Vitest (see "Tests" — no test files exist yet) |

## Architecture

```
src/
├── api/          axios client + one file per resource (auth/users/roles/permissions/
│                 auditLogs/simulator/policies), plus shared types.ts / errors.ts
├── auth/         AuthContext, ProtectedRoute, PermissionGate, RequirePermission, validators
├── pages/        one component per route
├── components/   generic, reused across pages (DataTable, Pagination, SearchInput,
│                 FormField, Button, Layout, Navbar, Sidebar, Forbidden, ErrorState,
│                 LanguageSwitcher)
├── config/       navigation.ts — single NAV_ITEMS source Sidebar + Navbar both render from
├── hooks/        useDebouncedValue (search inputs)
└── i18n/         locales/{en,hi,kn,fr}.json
```

### Auth model (`src/auth/AuthContext.tsx`)

- The access token lives **in memory only** (React state) — never `localStorage`, never a readable cookie. On mount, `AuthContext` attempts a silent refresh (`POST /auth/refresh`, using the httpOnly refresh cookie) to restore a session after a page reload; a 401 there means the user is simply logged out, not an error.
- `sessionExpired` is tracked separately from a plain logged-out state — a refresh that fails *after* a session was active (not just on initial mount) redirects to `/login` with a distinct "your session expired" message rather than looking like the user chose to log out.
- `login(email, password, tenantSlug)` — `tenantSlug` is required since Phase 9 (multi-tenant): the same email can exist in multiple orgs, so the slug disambiguates which account to authenticate against.
- `register(input)` — `input` is a discriminated union on `mode`: `create` (new org, registrant becomes its bootstrap admin) or `join` (existing org by slug, roleless by default). See `RegisterPage.tsx` for why this isn't a Zod discriminated union at the form-schema level (react-hook-form typing constraint — `mode` is plain component state instead).
- `currentUser` carries `{ id, name, email, roles, permissions, tenant: {id, name, slug} }` — gating is always on `permissions: string[]`, never `roles` (roles are shown for display only, e.g. in the Sidebar).

### Route guards

- `ProtectedRoute` — redirects to `/login` if not authenticated.
- `RequirePermission` (route-level) — renders `Forbidden` (a real "Access denied" page, not a silent redirect) if the current user lacks the named permission. Wired per-route in `App.tsx` for `/users`, `/roles`, `/permissions`, `/audit-logs`, `/simulator`, `/policies` — `/dashboard` needs no permission.
- `PermissionGate` (inline) — hides a specific element (e.g. an "Edit"/"Delete" button in a table row) rather than gating a whole page.

Note: ABAC self-service (Phase 8 — a user editing their own profile without `users.update`) is an **API-level** allowance only. There's no dedicated "my profile" page in this frontend, and `/users` itself is gated on `users.read` at the route level — a permission-less user can hit that self-service allowance via a direct API call, but not through this UI. See `backend/Phase-08.md`.

## Pages

`LoginPage`, `RegisterPage`, `DashboardPage`, `UsersPage`, `RolesPage`, `PermissionsPage`, `AuditLogsPage`, `PermissionSimulatorPage`, `PoliciesPage`, `NotFoundPage` — one per route, each following the same list/search/paginate/create/edit/delete pattern where applicable (see the individual `backend/Phase-XX.md` that introduced each one for the API shape it consumes).

## i18n

Every UI string goes through `react-i18next` — no hardcoded text. All 4 locale files (`src/i18n/locales/{en,hi,kn,fr}.json`) get a new key added together, never just `en.json` (i18next falls back to `en` for a missing key, but that's a stopgap during development, not a substitute for translating). `LanguageSwitcher` (in the Navbar) lets a user switch at runtime; the choice persists via `i18next-browser-languagedetector`.

## Tests

`npm test` runs Vitest, but **no `*.test.tsx` files exist yet** — Testing Library/MSW/jsdom are installed and configured, ready for whenever frontend unit tests are added, but none have been written through Phase 9. The real coverage today is:

- `npm run build` / `npm run lint` — clean on every phase.
- **Live browser verification** — every phase since Phase 4 has been manually driven end-to-end via Playwright (screenshots + `console --errors` checks) rather than relying on unit tests alone. See the relevant `backend/Phase-XX.md` "Verification" section and the root [HOW_TO_RUN.md](../HOW_TO_RUN.md) manual checklist for what's actually been exercised.

## API reference

See [../backend/README.md](../backend/README.md) for the full endpoint/permission/DB-shape reference this frontend consumes.
