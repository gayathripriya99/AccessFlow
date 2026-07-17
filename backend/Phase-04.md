# Phase 04 — Protected UI (React frontend)

## Objectives completed

- First protected frontend client, `frontend-react/` — the first of the four planned frontend folders (React/Angular/Vue/Next.js), per the master doc's phase ordering.
- Full auth flow wired to the Phase 1–3 backend: register → login → in-memory access token + httpOnly refresh cookie → silent refresh on page load → logout, plus a distinct **session-expiration** path (mid-session refresh failure) that surfaces a banner on `/login` instead of silently dropping the user, and route guards that redirect there automatically.
- Route-level and element-level permission gating that mirrors the backend's RBAC model exactly (never a hardcoded role check on the frontend either — everything reads off the resolved `permissions: string[]` from `/auth/me`). Desktop navigation (Sidebar) and mobile navigation (Navbar's drawer) are both generated from one `NAV_ITEMS` config (`src/config/navigation.ts`) filtered through the same `hasPermission` check, instead of two hand-maintained link lists.
- CRUD UI for all three Phase 2/3 resources: Permissions, Roles (with a permission-checkbox assignment UI), Users (activate/deactivate + role assignment; no create form — user creation stays at `/auth/register`, per `CLAUDE.md`).
- i18n scaffolding populated for all 4 required locales (English, Hindi, Kannada, French) and Tailwind configured with the master doc's exact breakpoint scale (320/375/425/768/1024/1280/1440/1920).
- One small, additive backend change: `GET /auth/me` now also returns `roles: string[]` and `permissions: string[]` (previously identity-only: `id`/`email`/`name`), so the frontend can resolve what to show/hide without a second round-trip. `AuthorizationService` gained `resolveAccess(userId)` (returns both role names and the flattened permission set in one query); `getPermissionNames` is now a thin wrapper around it so `requirePermission` middleware is unaffected.

## Round 2 additions (this continuation session)

The first pass (documented below, "Where this picked up from" onward) got the app compiling, routed, and CRUD-complete. This pass filled in the remaining items expected of a production-grade protected UI:

- **Sidebar** (`src/components/Sidebar.tsx`, new) — desktop-only (`xl:` / 1024px+) left nav, generated from `NAV_ITEMS`, plus a compact card showing the current user's name/email and role badges (display-only — never used for any access decision, per the RBAC rule in `CLAUDE.md`). `Navbar`'s mobile drawer (below `xl:`) renders the same `NAV_ITEMS` list instead of a second hardcoded set of links, and now closes itself on route change and on <kbd>Escape</kbd> (previously stayed open after tapping a link).
- **404 page** (`src/pages/NotFoundPage.tsx`, new) — the router's old top-level `path="*"` silently redirected any unmatched URL to `/dashboard`; it's now a single catch-all nested under the authenticated `Layout` route (see `App.tsx`'s routing comment for why one nested catch-all, not two, is the correct pattern here) that shows a real 404 with a link back to `/dashboard` or `/login` depending on auth status. `ProtectedRoute`'s own status check still runs first, so an unauthenticated visitor hitting a bad URL is redirected to `/login`, never shown the 404 shell.
- **403 page polish** — `Forbidden` (rendered by the existing `RequirePermission` route guard) gained a heading and a "back to dashboard" link instead of being a bare one-line alert.
- **Session expiration** — `AuthContext.clearSession` now takes an optional `reason: 'expired'`, set only when the axios interceptor's refresh-retry fails on an already-authenticated session (via `tokenStore`'s `notifyAuthFailure`), not on the initial silent-refresh-on-mount (never logged in) or an explicit logout. `ProtectedRoute` forwards this as router state when it redirects to `/login`; `LoginPage` reads it and shows an amber "your session has expired" banner, distinct from the existing green "account created" one.
- **List-query error states** — `UsersPage`/`RolesPage`/`PermissionsPage` previously only surfaced errors from create/update/delete mutations; a failed *list* fetch just showed nothing. New shared `ErrorState` component (`src/components/ErrorState.tsx`) renders the translated error message plus a retry button, wired to each page's `useQuery`'s `isError`/`error`/`refetch`.
- **Form validation on Roles/Permissions create-edit forms** — these previously relied on bare HTML `required` (untranslated browser tooltips, inconsistent with the zod-validated Login/Register forms). Added `validateNameDescription` (`src/auth/validators.ts`, zod-backed, trims whitespace-only input) and wired it into both pages' `onSubmit`, with `noValidate` on the `<form>` and per-field errors rendered through the existing `FormField` `error` prop.
- **Accessibility** — a skip-to-content link in `Layout` (visually hidden until focused), `<html lang>` now synced to the active i18next language via an `i18n.on('languageChanged', ...)` listener (previously fixed at `lang="en"` regardless of the selected UI language), and the Sidebar's nav landmark given a real `aria-label` instead of reusing the "Dashboard" link's own translation key.
- **i18n** — every new string above added to all 4 locale files together (`common.retry`, `common.fieldRequired`, `common.skipToContent`, `nav.toggleMenu`, `nav.mainNavigation`, `auth.login.sessionExpired`, `errors.forbiddenTitle`, `errors.notFoundTitle`, `errors.notFoundBody`, `errors.backToSafety`).
- Route-level guards (`ProtectedRoute`, `RequirePermission`), element-level guards (`PermissionGate`), the refresh-token flow, and React Query as the data-fetching layer were all already in place from the first pass — this round didn't change their design, just exercised/hardened what depends on them (see below).

## Where this picked up from

Most of `frontend-react/`'s scaffolding (API client, `AuthContext`/`ProtectedRoute`/`PermissionGate`, i18n, reusable components, Login/Register pages) plus the `/auth/me` backend change already existed on disk at the start of this phase, from an earlier session that was never archived or doc'd. That session stopped before the app was actually wired together or build-verified — `App.tsx`/`main.tsx` were still the raw Vite template (referencing deleted asset files, so the app didn't compile), and the four pages `Navbar`/`LoginPage` already linked to (`/dashboard`, `/users`, `/roles`, `/permissions`) didn't exist. This phase finished that work. See `chatdocument_doc_file/` for the full catch-up entry.

## Files created

```
frontend-react/src/
├── auth/RequirePermission.tsx      route-level guard — renders Forbidden instead of the page
├── config/navigation.ts            NAV_ITEMS — single source for Sidebar + Navbar's mobile drawer
├── components/
│   ├── Sidebar.tsx                 desktop (xl+) nav, generated from NAV_ITEMS + role-badge card
│   └── ErrorState.tsx              shared "query failed" block with a retry button
├── pages/
│   ├── DashboardPage.tsx           welcome + current user's roles/permissions
│   ├── NotFoundPage.tsx            404, catch-all route
│   ├── PermissionsPage.tsx         list/search/paginate + inline create/edit/delete
│   ├── RolesPage.tsx               same + permission-checkbox assignment
│   └── UsersPage.tsx               list/search/paginate + isActive toggle + role-checkbox assignment (no create)
frontend-react/tests/setup.ts       jest-dom matchers — vite.config.ts already referenced this path
```

## Files modified

- `src/main.tsx` — now mounts `QueryClientProvider` (`@tanstack/react-query`) and `BrowserRouter`, and imports `./i18n` for its init side effect. Previously just rendered the default Vite template.
- `src/App.tsx` — real route tree (public `/login`, `/register`; `ProtectedRoute` → `Layout` → `dashboard`/`users`/`roles`/`permissions`, each of the latter three wrapped in `RequirePermission`, plus a nested `path="*"` → `NotFoundPage`). Rewritten in round 2 to use idiomatic React Router relative child paths (`path="dashboard"` + `index`) instead of the original absolute-path children (`path="/dashboard"`) — functionally probably equivalent, but the relative form is the documented, unambiguous pattern and removes any doubt about how two `"*"` catch-alls at different tree depths would rank against each other.
- `src/components/{Navbar,Layout,Forbidden}.tsx` — Navbar now renders `NAV_ITEMS` in its mobile drawer (was a second hardcoded link list) and closes on route change/Escape; Layout renders `Sidebar` alongside `Navbar` and adds the skip-to-content link; Forbidden gained a heading + dashboard link.
- `src/auth/AuthContext.tsx` — `clearSession` takes an optional `reason: 'expired'`; new `sessionExpired` field on the context value.
- `src/auth/ProtectedRoute.tsx` — forwards `sessionExpired` as router state on the redirect to `/login`.
- `src/auth/validators.ts` — added `nameDescriptionSchema`/`validateNameDescription`, reused by Roles/Permissions forms.
- `src/pages/LoginPage.tsx` — reads `location.state.sessionExpired`, shows the new banner.
- `src/pages/{UsersPage,RolesPage,PermissionsPage}.tsx` — wired `ErrorState` into the list-query branch; Roles/Permissions forms switched from bare HTML `required` to `validateNameDescription` + `noValidate` + per-field `FormField` errors.
- `src/i18n/index.ts` — syncs `<html lang>` to the active i18next language.
- `index.html` — title changed from the default `frontend-react` to `AccessFlow`.
- Every pre-existing frontend source file that imported a type alongside a value (`import { Foo, type Bar } from ...` pattern) — `tsconfig`'s `verbatimModuleSyntax: true` requires type-only imports to use `import type`, and this hadn't been caught yet because `npm run build` had never actually been run against this scaffolding. Split into value + `import type` imports across `src/api/*.ts`, `src/auth/AuthContext.tsx`, `src/auth/PermissionGate.tsx`, `src/components/{Button,DataTable,FormField,Pagination}.tsx`, `src/pages/{LoginPage,RegisterPage}.tsx` — no behavior change, compile-only fix.
- `src/i18n/locales/{en,hi,kn,fr}.json` — added `common.noResults` (first pass); round 2 added `common.retry`/`fieldRequired`/`skipToContent`, `nav.toggleMenu`/`mainNavigation`, `auth.login.sessionExpired`, `errors.forbiddenTitle`/`notFoundTitle`/`notFoundBody`/`backToSafety` — to all 4 locale files together, per `CLAUDE.md`'s i18n rule.
- Backend: `backend/src/services/AuthorizationService.ts` (`resolveAccess`), `backend/src/services/AuthService.ts` (`getCurrentUser` return shape), `backend/src/routes/v1/auth.routes.ts` (wires `AuthorizationService` into `AuthService`'s constructor), `backend/tests/auth.test.ts` (asserts the new `/auth/me` shape for the bootstrap-admin case). No backend changes in round 2 — everything added there was frontend-only.

## Frontend architecture notes (non-obvious, worth knowing before touching this code)

- **Access token lives in memory only** (`src/auth/tokenStore.ts`), never `localStorage` — avoids XSS token theft. It's lost on page refresh by design; `AuthContext` silently calls `/auth/refresh` (the httpOnly cookie) on mount to recover the session, showing a `loading` status in the meantime.
- **`PermissionGate` vs `RequirePermission`** are deliberately separate, narrow components, not one configurable one: `PermissionGate` hides/shows inline elements (nav links, action buttons) and renders nothing (or a `fallback`) when denied; `RequirePermission` is a route element that renders the existing `Forbidden` component instead of the page. A user without `users.read` never sees the Users nav link, but if they navigate to `/users` directly by URL, they see a real "you don't have permission" page instead of a broken/empty one — enforcement isn't just cosmetic nav-hiding.
- **List endpoints return unpopulated id arrays; only single-item `GET`/`PATCH` responses populate.** Confirmed against the real backend (`backend/src/repositories/RoleRepository.ts`'s `list()` has no `.populate()`, `updateById()` does): `RolesPage`/`UsersPage` list views show a permission/role *count*, not names, to avoid an extra fetch; the create/edit forms' checkboxes are populated from a separate `listPermissions`/`listRoles` call (capped at `limit: 100`, which comfortably covers the 11 baseline permissions plus any custom ones for a project this size).
- **No `UsersPage` create form** — `POST /users` doesn't exist by design (`CLAUDE.md`: user creation stays at `/auth/register`); the page only supports editing `isActive` and role assignment, plus delete.
- **Delete confirmations use the native `window.confirm`**, not a custom modal component — kept deliberately minimal since no other part of the UI needed a modal/dialog primitive yet.

## Verification

- `cd frontend-react && npm run build` (`tsc -b && vite build`) — clean, both after round 1 and again after round 2's changes.
- `cd frontend-react && npm run lint` (oxlint) — clean (one pre-existing, harmless `react-refresh` fast-refresh warning on `AuthContext.tsx` for exporting both a component and the `useAuth` hook from the same file — unchanged across both rounds).
- `cd backend && npm test` — still 30/30 passing; round 2 made no backend changes, re-run purely to confirm nothing else regressed.
- Round 1 live smoke test: booted the real `createApp()` server against a standalone in-memory MongoDB (same technique as Phases 1–3), then drove it with real `curl` end-to-end for exactly what the pages call: registered a first ("admin") user and confirmed `/auth/me` returns `roles: ["admin"]` and all 11 baseline `permissions`; created a custom permission and a role bundling it (mirrors `PermissionsPage`/`RolesPage`'s create forms); confirmed `GET /roles` list responses return unpopulated permission-id arrays (confirms the count-only list-view design decision above) while `PATCH /users/:id` returns fully populated roles (confirms the edit-form flow); registered a second user, assigned them the custom role, and confirmed their `/auth/me` and a direct `GET /users` 403 — exactly the shape `RequirePermission`/`PermissionGate` rely on.
- **Still not verified**: no browser-automation tool is available in this environment, so the UI has never been visually/interactively exercised in a real browser, in either round. Type-checking, linting, and the backend-side smoke test confirm the API contracts and guard *logic* are correct by inspection, but things like the Sidebar/Navbar breakpoint handoff at exactly `xl` (1024px), the mobile drawer's focus/Escape behavior, and the 404 route's interaction with `ProtectedRoute` have only been reasoned through against React Router's documented matching rules, not observed rendering. A manual `npm run dev` + browser click-through (register → login → resize through all 8 breakpoints → create a permission → create a role → assign it to a user → trigger a 403 by URL → trigger a 404 → let a session expire and confirm the login banner) remains the top recommended follow-up before calling this UI production-ready.

## Remaining work (next phases)

- Phase 5: Audit Log query/viewing API and UI (write path has existed since Phase 1/2).
- Phase 6: Permission Simulator.
- Phase 7: Advanced RBAC.
- Phase 8: ABAC + multi-tenant.
- No automated frontend tests exist yet (`vitest`/`msw`/`@testing-library/react` are installed and `tests/setup.ts` now exists, but no `*.test.tsx` files have been written) — worth doing before this UI is considered production-ready, not just build-clean. Would also be the fastest way to close the "not verified in a browser" gap above without needing a browser-automation tool (RTL + jsdom can exercise the route guards, form validation, and error states directly).
- `frontend-angular/`, `frontend-vue/`, `frontend-nextjs/` still don't exist — only React has been built so far; confirm with the user whether the other three are actually wanted or whether the master doc's mention of them was aspirational/optional.
- Still-open from Phase 3: the 13 missing planned docs in `doc_file/`, where the "Modern AI Chatbot module" fits, and confirming the MongoDB Atlas note doesn't change local/test DB usage. No CI/CD, no Vercel/Render/Atlas deployment configured.
- The user has proposed a reordered post-Phase-4 roadmap (Dashboard/Analytics → Audit Logs → Permission Simulator → AI Chatbot → i18n polish → responsive polish → security hardening → Docker → CI/CD → deployment → testing → final docs) — not yet applied to this table or `README.md`'s phase list; confirm before Phase 5 planning starts.
