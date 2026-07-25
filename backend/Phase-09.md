# Phase 09 — Multi-tenant

## Scope decision

Multi-tenant was deferred from Phase 8's original "ABAC + Multi-tenant" scoping (see `Phase-08.md`'s own scope decision). Given its size — touching nearly every model, query, and test in the backend — the user was asked how to scope it before any code was written, the same way Phase 8 itself was scoped. **The user chose "full isolation, done properly"**: every tenant-scoped model gets a `tenantId`, every repository query is tenant-scoped, uniqueness constraints that were previously global (email, permission/role/policy names) become per-tenant, the JWT carries a tenant claim, and every existing test is reviewed/fixed rather than batch-patched. Explicitly not the lighter "registration-time tenancy only" alternative.

This phase spanned two sessions with a mid-phase pause: session 08 designed the approach and landed only the first slice of model changes (uncommitted, non-functional on its own); session 09 finished the rest of the backend, the entire frontend, and live browser verification. See `chatdocument_doc_file/2026-07-21_session-08_phase9-multitenant-PAUSED.md` and `..._session-09_phase9-multitenant-PAUSED.md` for the session-by-session history if the design rationale below needs more detail.

## Objectives completed

- A new **Tenant** model (`{name, slug}`) — `slug` is the one thing that stays *globally* unique, since it's how a tenant is looked up before any tenant context exists (register/login time, from an unauthenticated request).
- **Registration is a discriminated union on `mode`**: `create` (starts a brand-new org; the registrant becomes its bootstrap admin, same idempotent permission/policy seeding as before, just scoped to the new tenant) or `join` (registers into an existing org by slug as a roleless user — the same "every non-first registration gets zero roles" behavior as always, just per-tenant instead of per-database).
- **Login requires a `tenantSlug`** — necessary because email uniqueness is now per-tenant, so the same email can exist in multiple orgs; the slug disambiguates which account to authenticate against. A wrong slug, wrong password, and nonexistent account all produce the same generic 401 — no org-slug or account-existence enumeration.
- **JWT access tokens carry `tenantId`**; `requireAuth` populates `req.auth.tenantId` from it. This is the value threaded into every service/repository call for the rest of the request.
- **Every tenant-scoped repository method takes `tenantId` as a new, required, always-first parameter** — a compile-time guarantee against an accidentally-unscoped query, not a runtime convention someone has to remember. `RefreshTokenRepository` is the one deliberate exception: refresh tokens are keyed by `jti`/`userId`, never listed/queried by tenant, and a user's tenant is already transitively implied by `userId`.
- **`AdminBootstrapService` is per-tenant**: "first user" now means "first user in this tenant," and the baseline 17 permissions + 3 ABAC policies are seeded per-tenant (they're tenant-scoped documents now, so they can't be shared across tenants even if they wanted to be).
- Every other service/controller/middleware — `AuthorizationService`, `AbacService` (also tenant-scopes `PolicyRepository.findApplicable`, otherwise one tenant's custom policies could leak into another's ABAC evaluation), `SimulatorService`, `PermissionService`, `RoleService`, `UserService`, `PolicyService`, `AuditLogService`, `requirePermission`/`requireAccess` — threaded with `tenantId` the same way.
- **Frontend**: register/login forms gained a create-vs-join mode toggle and tenant slug field; `/auth/me`'s response (and the Sidebar) now surfaces the current tenant's name.
- **New `tests/tenant-isolation.test.ts`** (10 tests) proving actual isolation, not just that the code compiles — see "Verification" below.

## Design decisions worth knowing before touching this code

- **Explicit-parameter threading over per-request repository instances.** The alternative — constructing repositories/services per-request with `tenantId` bound into the instance — would also isolate tenants, but requires restructuring how every route file wires its dependencies (currently module-level singletons). Making `tenantId` the first parameter of every method keeps the existing wiring pattern and gets the same "impossible to forget" guarantee from the type system instead: a call site missing the argument is a TypeScript error, not a bug that surfaces later as a cross-tenant leak.
- **`RefreshTokenRepository` was deliberately left untouched.** Adding `tenantId` there would be scope creep with no isolation benefit — nothing about the refresh-token flow is ever listed or filtered by tenant.
- **The refresh/logout flow needed one addition beyond the original design**: `UserRepository.findByIdAcrossTenants(id)`. The refresh JWT carries no tenant claim (only `sub`/`jti`), so `refresh` and `logout` can't tenant-scope their initial user lookup the normal way — they look the user up by id across all tenants, and that document's own `tenantId` re-establishes tenant context for everything after.
- **Login's error messages stay generic on purpose.** Wrong email, wrong password, wrong tenant slug, and a tenant slug that doesn't exist at all all produce the same "Invalid email, password, or organization" 401 — distinguishing them would let an attacker enumerate which orgs exist or which emails are registered in a given org.
- **Test helper redesign, not a signature tweak.** `createAuthenticatedUser()` always creates a brand-new org (preserving "the first call becomes admin"). A new `joinOrg(app, tenantSlug)` registers a second user into an *existing* org — this is what most pre-Phase-9 multi-user tests actually needed (two users who can see each other), since they were unknowingly relying on "same database" standing in for "same org." `createNonAdminUser` is now `createAuthenticatedUser` + `joinOrg` internally, so no call site that already used it needed to change.
- **Every pre-existing multi-user test was audited call-by-call, not batch-replaced.** Tests genuinely expecting two users in the same org had their second call swapped to `joinOrg`; tests that only ever created one user, or that 403 before any tenant-scoped lookup happens (a permission check failing is tenant-independent), were left alone.
- **The frontend register form is not a Zod discriminated union**, unlike the backend validator — react-hook-form's `FieldErrors`/`register` typing doesn't cope well with a union where a field (`tenantName`) only exists on one branch. Instead it's one flat schema with `tenantName` optional at the schema level; `RegisterPage` keeps `mode` as plain component state (not a form field) and enforces the create-mode `tenantName` requirement itself via `setError(...)` before building the actual discriminated `RegisterInput` payload for the API call.

## Files created

```
backend/src/
├── models/Tenant.ts                      {name, slug} — slug globally unique
├── repositories/TenantRepository.ts      findBySlug/findById/create

backend/tests/tenant-isolation.test.ts    same-email-different-org, duplicate slug 409,
                                          join-nonexistent-slug 404, login slug/password
                                          combinations, name collisions across tenants,
                                          cross-tenant 404s (not 403s) on user
                                          read/update/delete and simulator checks,
                                          cross-tenant list isolation, cross-tenant
                                          permission id rejected on role create
```

## Files modified

- `backend/src/models/{User,Role,Permission,Policy}.ts` — added `tenantId` (required, indexed); each model's previously-global unique field (`email`/`name`/`name`/`name`) is now a compound `{tenantId, <field>}` unique index instead of a standalone global one.
- `backend/src/models/AuditLog.ts` — added `tenantId` (required, indexed — no uniqueness needed, just query scoping).
- All 5 repositories (`User`/`Role`/`Permission`/`Policy`/`AuditLogRepository`) — every method gained `tenantId` as a new required first parameter.
- `backend/src/validators/auth.validators.ts` — `registerSchema` is now the `create`/`join` discriminated union described above; `loginSchema` gained `tenantSlug`.
- `backend/src/utils/jwt.ts` — `AccessTokenPayload` gained `tenantId`.
- `backend/src/middlewares/requireAuth.ts` — `req.auth` gained `tenantId`.
- `backend/src/services/AuthService.ts` — `register` resolves-or-creates the `Tenant` first, then scopes bootstrap/creation to it; `login` resolves the tenant by slug before verifying credentials; `refresh`/`logout` use `findByIdAcrossTenants` to recover tenant context; `getCurrentUser` returns `tenant: {id, name, slug}`.
- `backend/src/services/AdminBootstrapService.ts` — "first user" scoped per-tenant; takes a `PolicyRepository` dependency unchanged from Phase 8, just tenant-aware now.
- `backend/src/services/{AuthorizationService,AbacService,SimulatorService,PermissionService,RoleService,UserService,PolicyService,AuditLogService}.ts` and their controllers — every method threaded with `tenantId`, pulled from `req.auth!.tenantId` at the controller layer.
- `backend/src/middlewares/{requireAccess,requirePermission}.ts` — tenant-scoped resolution.
- `backend/src/routes/v1/auth.routes.ts` — wires in the new `TenantRepository`.
- `backend/tests/helpers/authenticatedUser.ts` — redesigned as described above (`createAuthenticatedUser` returns `{accessToken, userId, tenantSlug}`; new `joinOrg`; `createNonAdminUser` composes both).
- `backend/tests/{auditLog,auth,policies,roles,simulator,users}.test.ts` — audited call-by-call for the right helper at each multi-user call site.
- `frontend-react/src/api/types.ts` — `CurrentUser` gained `tenant: {id, name, slug}`.
- `frontend-react/src/api/auth.ts` — `RegisterInput` discriminated union; `LoginInput` gained `tenantSlug`.
- `frontend-react/src/auth/validators.ts` — `loginSchema` gained `tenantSlug`; `registerSchema` is the flat (non-union) schema described above.
- `frontend-react/src/auth/AuthContext.tsx` — `login(email, password, tenantSlug)`.
- `frontend-react/src/pages/LoginPage.tsx` — added a tenant-slug field.
- `frontend-react/src/pages/RegisterPage.tsx` — rewritten with a create/join mode toggle; `tenantName` renders only in create mode.
- `frontend-react/src/components/Sidebar.tsx` — shows the tenant name above the user's name/email/roles block.
- `frontend-react/src/i18n/locales/{en,hi,kn,fr}.json` — added `auth.login.tenantSlug`, `auth.register.modeLabel/modeCreate/modeJoin/tenantName/tenantSlug`, `auth.validation.tenantNameRequired/tenantSlugRequired/tenantSlugInvalid`, to all 4 files together.

## Verification

- `cd backend && npm run build && npm run lint && npm test` — clean; **73/73 tests passing** (63 pre-existing + 10 new in `tenant-isolation.test.ts`).
- `cd frontend-react && npm run build && npm run lint` — clean (same one pre-existing harmless Fast-Refresh warning on `AuthContext.tsx` as every prior phase).
- **Live browser verification** (Playwright, `chromium.launch()` + `newContext().newPage()` directly — same fallback used in prior phases, no `chromium-cli` in this environment). Ran both dev servers against a separate temporary database (`accessflow_phase9_verify`) to avoid touching the existing dev data. Confirmed:
  - Registering a brand-new org ("Acme Corp", slug `acme-corp`) works; the registrant lands as its admin with all 17 baseline permissions.
  - Registering a **second** org ("Globex Inc", slug `globex-inc`) with the **exact same email** as the first succeeds — proves per-tenant, not global, email uniqueness.
  - Each org's Sidebar shows its own tenant name.
  - Logging in with the right email but the *other* org's password, against a given tenant slug, is rejected with the generic invalid-credentials message.
  - A third user ("Carol") joined Globex Inc via join-mode registration, landing with 0 roles (correct non-admin default).
  - Acme Corp's Users list shows only Alice; Globex Inc's shows only Bob and Carol — real cross-tenant list isolation, not just an API-level assertion.
  - The register page's mode toggle correctly shows/hides the "Organization name" field; zero browser console errors throughout.

## Remaining work

- No `userId`-filter picker on the audit log page (Phase 5, still open).
- Permission Simulator still doesn't evaluate ABAC (Phase 8, still open) — now additionally doesn't need a cross-tenant resource-id concern, since a `mode: "user"` simulator check already 404s on a cross-tenant user id (proven in `tenant-isolation.test.ts`).
- ABAC still only supports the `user` resource (Phase 8, still open).
- No automated frontend tests (`*.test.tsx`); Playwright remains available as a devDependency.
- `frontend-angular`/`frontend-vue`/`frontend-nextjs` don't exist.
- The roadmap-reorder question remains formally unresolved.
- No CI/CD or deployment configuration.
- No tenant management UI (renaming a tenant, inviting users by email rather than by sharing a join slug, removing a tenant) — this phase only built the isolation and the create/join flows, not an admin-facing tenant-settings surface.
