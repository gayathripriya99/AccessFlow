# Phase 04 — Protected UI (React frontend)

## Objectives completed

- First protected frontend client, `frontend-react/` — the first of the four planned frontend folders (React/Angular/Vue/Next.js), per the master doc's phase ordering.
- Full auth flow wired to the Phase 1–3 backend: register → login → in-memory access token + httpOnly refresh cookie → silent refresh on page load → logout.
- Route-level and element-level permission gating that mirrors the backend's RBAC model exactly (never a hardcoded role check on the frontend either — everything reads off the resolved `permissions: string[]` from `/auth/me`).
- CRUD UI for all three Phase 2/3 resources: Permissions, Roles (with a permission-checkbox assignment UI), Users (activate/deactivate + role assignment; no create form — user creation stays at `/auth/register`, per `CLAUDE.md`).
- i18n scaffolding populated for all 4 required locales (English, Hindi, Kannada, French) and Tailwind configured with the master doc's exact breakpoint scale (320/375/425/768/1024/1280/1440/1920).
- One small, additive backend change: `GET /auth/me` now also returns `roles: string[]` and `permissions: string[]` (previously identity-only: `id`/`email`/`name`), so the frontend can resolve what to show/hide without a second round-trip. `AuthorizationService` gained `resolveAccess(userId)` (returns both role names and the flattened permission set in one query); `getPermissionNames` is now a thin wrapper around it so `requirePermission` middleware is unaffected.

## Where this picked up from

Most of `frontend-react/`'s scaffolding (API client, `AuthContext`/`ProtectedRoute`/`PermissionGate`, i18n, reusable components, Login/Register pages) plus the `/auth/me` backend change already existed on disk at the start of this phase, from an earlier session that was never archived or doc'd. That session stopped before the app was actually wired together or build-verified — `App.tsx`/`main.tsx` were still the raw Vite template (referencing deleted asset files, so the app didn't compile), and the four pages `Navbar`/`LoginPage` already linked to (`/dashboard`, `/users`, `/roles`, `/permissions`) didn't exist. This phase finished that work. See `chatdocument_doc_file/` for the full catch-up entry.

## Files created

```
frontend-react/src/
├── auth/RequirePermission.tsx      route-level guard — renders Forbidden instead of the page
├── pages/
│   ├── DashboardPage.tsx           welcome + current user's roles/permissions
│   ├── PermissionsPage.tsx         list/search/paginate + inline create/edit/delete
│   ├── RolesPage.tsx               same + permission-checkbox assignment
│   └── UsersPage.tsx               list/search/paginate + isActive toggle + role-checkbox assignment (no create)
frontend-react/tests/setup.ts       jest-dom matchers — vite.config.ts already referenced this path
```

## Files modified

- `src/main.tsx` — now mounts `QueryClientProvider` (`@tanstack/react-query`) and `BrowserRouter`, and imports `./i18n` for its init side effect. Previously just rendered the default Vite template.
- `src/App.tsx` — replaced entirely with the real route tree (public `/login`, `/register`; `ProtectedRoute` → `Layout` → `/dashboard`, `/users`, `/roles`, `/permissions`, each of the latter three wrapped in `RequirePermission`).
- `index.html` — title changed from the default `frontend-react` to `AccessFlow`.
- Every pre-existing frontend source file that imported a type alongside a value (`import { Foo, type Bar } from ...` pattern) — `tsconfig`'s `verbatimModuleSyntax: true` requires type-only imports to use `import type`, and this hadn't been caught yet because `npm run build` had never actually been run against this scaffolding. Split into value + `import type` imports across `src/api/*.ts`, `src/auth/AuthContext.tsx`, `src/auth/PermissionGate.tsx`, `src/components/{Button,DataTable,FormField,Pagination}.tsx`, `src/pages/{LoginPage,RegisterPage}.tsx` — no behavior change, compile-only fix.
- `src/i18n/locales/{en,hi,kn,fr}.json` — added `common.noResults` (empty-table-state copy for the three new list pages).
- Backend: `backend/src/services/AuthorizationService.ts` (`resolveAccess`), `backend/src/services/AuthService.ts` (`getCurrentUser` return shape), `backend/src/routes/v1/auth.routes.ts` (wires `AuthorizationService` into `AuthService`'s constructor), `backend/tests/auth.test.ts` (asserts the new `/auth/me` shape for the bootstrap-admin case).

## Frontend architecture notes (non-obvious, worth knowing before touching this code)

- **Access token lives in memory only** (`src/auth/tokenStore.ts`), never `localStorage` — avoids XSS token theft. It's lost on page refresh by design; `AuthContext` silently calls `/auth/refresh` (the httpOnly cookie) on mount to recover the session, showing a `loading` status in the meantime.
- **`PermissionGate` vs `RequirePermission`** are deliberately separate, narrow components, not one configurable one: `PermissionGate` hides/shows inline elements (nav links, action buttons) and renders nothing (or a `fallback`) when denied; `RequirePermission` is a route element that renders the existing `Forbidden` component instead of the page. A user without `users.read` never sees the Users nav link, but if they navigate to `/users` directly by URL, they see a real "you don't have permission" page instead of a broken/empty one — enforcement isn't just cosmetic nav-hiding.
- **List endpoints return unpopulated id arrays; only single-item `GET`/`PATCH` responses populate.** Confirmed against the real backend (`backend/src/repositories/RoleRepository.ts`'s `list()` has no `.populate()`, `updateById()` does): `RolesPage`/`UsersPage` list views show a permission/role *count*, not names, to avoid an extra fetch; the create/edit forms' checkboxes are populated from a separate `listPermissions`/`listRoles` call (capped at `limit: 100`, which comfortably covers the 11 baseline permissions plus any custom ones for a project this size).
- **No `UsersPage` create form** — `POST /users` doesn't exist by design (`CLAUDE.md`: user creation stays at `/auth/register`); the page only supports editing `isActive` and role assignment, plus delete.
- **Delete confirmations use the native `window.confirm`**, not a custom modal component — kept deliberately minimal since no other part of the UI needed a modal/dialog primitive yet.

## Verification

- `cd frontend-react && npm run build` (`tsc -b && vite build`) — clean.
- `cd frontend-react && npm run lint` (oxlint) — clean (one pre-existing, harmless `react-refresh` fast-refresh warning on `AuthContext.tsx` for exporting both a component and the `useAuth` hook from the same file).
- `cd backend && npm test` — still 30/30 passing after the `/auth/me` shape change.
- Live smoke test: booted the real `createApp()` server against a standalone in-memory MongoDB (same technique as Phases 1–3), then drove it with real `curl` end-to-end for exactly what the new pages call: registered a first ("admin") user and confirmed `/auth/me` returns `roles: ["admin"]` and all 11 baseline `permissions`; created a custom permission and a role bundling it (mirrors `PermissionsPage`/`RolesPage`'s create forms); confirmed `GET /roles` list responses return unpopulated permission-id arrays (confirms the count-only list-view design decision above) while `PATCH /users/:id` returns fully populated roles (confirms the edit-form flow); registered a second user, assigned them the custom role, and confirmed their `/auth/me` and a direct `GET /users` 403 — exactly the shape `RequirePermission`/`PermissionGate` rely on.
- **Not verified**: no browser-automation tool is available in this environment, so the UI was not visually/interactively exercised in a real browser. Type-checking, linting, and the backend-side smoke test above confirm the API contracts and route-guard logic are correct, but a manual `npm run dev` + browser click-through (register → login → create a permission → create a role → assign it to a user → confirm nav/route gating changes) is a recommended follow-up before treating this as fully done.

## Remaining work (next phases)

- Phase 5: Audit Log query/viewing API and UI (write path has existed since Phase 1/2).
- Phase 6: Permission Simulator.
- Phase 7: Advanced RBAC.
- Phase 8: ABAC + multi-tenant.
- No automated frontend tests exist yet (`vitest`/`msw`/`@testing-library/react` are installed and `tests/setup.ts` now exists, but no `*.test.tsx` files have been written) — worth doing before this UI is considered production-ready, not just build-clean.
- `frontend-angular/`, `frontend-vue/`, `frontend-nextjs/` still don't exist — only React has been built so far; confirm with the user whether the other three are actually wanted or whether the master doc's mention of them was aspirational/optional.
- Still-open from Phase 3: the 13 missing planned docs in `doc_file/`, where the "Modern AI Chatbot module" fits, and confirming the MongoDB Atlas note doesn't change local/test DB usage. No CI/CD, no Vercel/Render/Atlas deployment configured.
