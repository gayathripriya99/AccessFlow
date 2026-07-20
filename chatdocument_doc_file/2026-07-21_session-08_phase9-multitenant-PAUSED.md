# Session 08 — 2026-07-21 (PAUSED MID-PHASE)

**Scope of this session:** Started Phase 9 (multi-tenant, deferred from Phase 8's "ABAC + Multi-tenant" scoping). User asked to pause partway through — this file exists so a future session can resume from an accurate picture of what's actually done, not what was planned.

> How to use this file: if you say "refer that chat and continue from where you stopped," read this whole file before touching any code. **The working tree currently has uncommitted, incomplete, non-functional changes** — see "Exact current state" below before assuming anything works.

---

## 1. Scoping decision (made this session, before any code)

Per session 07's own "what's next" note, multi-tenant was the obvious next candidate — the only piece of the original 8-phase roadmap left unstarted. Given its scale (touches nearly every model, query, and test — a different kind of change than any single-feature phase so far), asked the user how to scope it rather than assume, mirroring how Phase 8 itself was scoped. **The user chose "full isolation, done properly"** — every model gets `tenantId`, every repository query gets tenant-scoped, uniqueness constraints (email, permission/role/policy names) go from global to per-tenant, a JWT tenant claim, and all existing tests get reviewed/fixed. Explicitly not the lighter "registration-time tenancy only" option.

## 2. Full design (decided, mostly not yet built — see section 3 for what's actually done)

- **New `Tenant` model**: `{name, slug}` — `slug` is the *one* thing that stays globally unique (it's how a tenant is looked up before any tenant context exists, at register/login time).
- **Registration becomes a discriminated union**: `{mode: 'create', email, password, name, tenantName, tenantSlug}` (creates a new org, registering user becomes its bootstrap admin — same idempotent-seeding logic as today, just scoped) or `{mode: 'join', email, password, name, tenantSlug}` (joins an existing org as a roleless user, same as today's "every later registration gets zero roles" — just now per-tenant instead of per-database).
- **Login gains a required `tenantSlug`** — necessary because email uniqueness is now per-tenant, so the same email could exist in multiple orgs; the tenant slug disambiguates which account to authenticate against.
- **JWT access token payload gains `tenantId`**; `requireAuth` populates `req.auth.tenantId` from it. This becomes the source of truth threaded into every service/repository call for the rest of the request.
- **Every tenant-scoped repository method gets `tenantId` as a new, required, always-first parameter** (not optional, not bundled into an existing options object) — chosen specifically so a missing tenant scope is a *compile error*, not a runtime bug someone has to remember to avoid. This was a deliberate architecture decision: the alternative (constructing repositories/services per-request with tenantId bound into the instance) would also work but requires restructuring how every route file wires its dependencies (currently module-level singletons); explicit-parameter-threading keeps the existing wiring pattern and gets the same "impossible to forget" guarantee via the type system instead.
- **`RefreshTokenRepository` deliberately does *not* get `tenantId`** — refresh tokens are keyed by `jti`/`userId`, never listed or queried by any tenant-scoped UI, and a user's tenant is already transitively implied by their `userId`. Adding it would be scope creep with no isolation benefit.
- **`AdminBootstrapService` becomes per-tenant**: "first user in a given tenant" (not "first user ever in the database") gets that tenant's admin role, and the baseline 17 permissions + 3 ABAC policies get seeded *per tenant* (they're tenant-scoped documents now, so they literally can't be shared across tenants).
- **Every existing service/controller method threaded with `tenantId`** the same way — `AuthorizationService.resolveAccess`, `SimulatorService`, `AbacService`, `PermissionService`, `RoleService`, `UserService`, `PolicyService`, and their controllers.
- **Test helpers need a real redesign, not just a signature tweak**: `createAuthenticatedUser()` will always create a *brand-new* org (so the "first call becomes admin" property still holds), which means every existing test that currently calls it twice expecting "two users in the same system" (the vast majority of multi-user tests — role assignment, audit log actor checks, ABAC self-vs-other checks, etc.) needs a **new** helper for "another user joining the *same* org as an existing one," and each of the 7 existing test files needs auditing to use the right one at each call site. This is a large, mechanical, file-by-file task — not started.
- **Frontend**: register/login forms need a create-org-vs-join-org mode and a tenant slug field; `/auth/me`'s `CurrentUser` should probably surface tenant name/slug for display (e.g. in the Sidebar).

## 3. Exact current state — what's actually done vs. not

**Done (uncommitted):**
- `backend/src/models/Tenant.ts` (new) — the model described above.
- `backend/src/repositories/TenantRepository.ts` (new) — `findBySlug`/`findById`/`create`.
- `backend/src/models/User.ts` — added `tenantId` (required, indexed), removed the old global `unique: true` on `email`, added a compound `{tenantId, email}` unique index.
- `backend/src/models/Role.ts` — same pattern for `name`.
- `backend/src/models/Permission.ts` — same pattern for `name`.
- `backend/src/models/Policy.ts` — same pattern for `name`.

**Not done — everything else in section 2's design, specifically:**
- `backend/src/models/AuditLog.ts` — **not yet given a `tenantId` field.** Was the very next planned step when the pause happened.
- **All 5 repositories** (`UserRepository`, `RoleRepository`, `PermissionRepository`, `PolicyRepository`, `AuditLogRepository`) — **still have their pre-Phase-9 signatures.** None of their methods take `tenantId` yet. `UserRepository.create()`, for example, still only accepts `{email, passwordHash, name}` — no `tenantId` — which means calling it right now would throw a Mongoose validation error (`tenantId` is required on the schema but nothing supplies it).
- **Auth flow** (`auth.validators.ts`, `AuthService`, `jwt.ts`, `requireAuth.ts`, `AuthController`) — **completely untouched.** Register/login still take the old flat body shape with no tenant fields; the JWT payload has no `tenantId`; `requireAuth` still populates `req.auth` as `{userId, email}` only.
- `AdminBootstrapService` — **untouched**, still does the old "first user in the whole database" check.
- Every other service/controller (`PermissionService`, `RoleService`, `UserService`, `PolicyService`, `AuthorizationService`, `SimulatorService`, `AbacService`, and their controllers) — **untouched.**
- **All 7 existing test files and the test helpers** — **untouched.**
- **Frontend** — **completely untouched.**
- **Nothing has been verified.** `npm run build` currently reports clean (see next paragraph for why that's misleading), `npm test` has **not** been run and would almost certainly fail/hang the moment any test tries to register a user, since the register endpoint doesn't even accept the fields the new model requires yet.

**Important nuance for whoever resumes:** `npm run build` passing right now does **not** mean this is safe or close to done. Mongoose's `.create()` calls aren't strictly type-checked against a model's *runtime-required* schema fields the way, say, a constructor argument would be — TypeScript is happy with the existing repository code even though calling it would now fail at runtime with "tenantId: Path `tenantId` is required." Don't take a clean `tsc` as a signal of progress here; the real signal is whether `npm test` passes, and it hasn't been run since these model changes landed.

**Git state:** nothing committed. `git status --short` at pause time:
```
 M backend/src/models/Permission.ts
 M backend/src/models/Policy.ts
 M backend/src/models/Role.ts
 M backend/src/models/User.ts
?? backend/src/models/Tenant.ts
?? backend/src/repositories/TenantRepository.ts
```
`origin/main` and local `main` both still sit at `2581006` (Phase 8, ABAC) — this session added zero commits.

## 4. Resuming — exact next steps, in order

1. Re-verify this file's "exact current state" still matches `git status`/`git diff` — don't assume time hasn't passed or nothing else changed.
2. Add `tenantId` to `backend/src/models/AuditLog.ts` (required, indexed — no uniqueness constraint needed there, just query performance, matching the pattern already used on the other four models).
3. Thread `tenantId` through all 5 repositories — every method, as a new required first parameter. `RefreshTokenRepository` is the one deliberate exception (see section 2).
4. Rewrite the auth flow: `auth.validators.ts` (discriminated union for register, `tenantSlug` added to login), `AuthService.register`/`login` (tenant lookup/creation logic), `jwt.ts` (`tenantId` in the access token payload), `requireAuth.ts` (populate `req.auth.tenantId`), `AuthController` (no changes expected beyond what flows through automatically).
5. `AdminBootstrapService` — per-tenant first-user check and per-tenant seeding of permissions/admin-role/policies.
6. Thread `tenantId` through every remaining service and controller (`PermissionService`, `RoleService`, `UserService`, `PolicyService`, `AuthorizationService`, `SimulatorService`, `AbacService` + their controllers) and the route files that extract it from `req.auth`.
7. Redesign `tests/helpers/authenticatedUser.ts`: `createAuthenticatedUser` always creates a fresh org (unchanged contract otherwise); add a new helper for "another user joining an existing org"; `createNonAdminUser` uses the new helper internally. Then go through **all 7 existing test files** and fix every multi-user test to use the right helper for what it's actually testing (same-org vs., in principle, different-org — audit each call site, don't batch-replace blindly).
8. Write a new `tenant-isolation.test.ts` proving the actual security property: a user in tenant A cannot read/write/list any tenant-B resource by id, even when they hold the relevant permission within their own tenant, and cannot register a second admin-slot-consuming account in an org that already has one.
9. `npm run build && npm run lint && npm test` — iterate until green. This is the real checkpoint, not step 2's build check.
10. Frontend: register/login forms (mode toggle + tenant fields), tenant display somewhere in the shell (Sidebar is the natural spot, matching how the current user's roles are already shown there).
11. `npm run build`/`lint` on the frontend.
12. Live browser verification — the important proof here is **two separate tenants, created from scratch, provably isolated**: same email registers successfully in both, users/roles/permissions created in one are invisible to the other, cross-tenant id guessing on a `:id` route 404s or 403s rather than leaking data.
13. Docs: `backend/Phase-09.md` (lead with the scope decision, same as Phase-08.md did), README phase table, `CLAUDE.md`, `backend/README.md`, and a fresh (non-paused) session archive entry documenting the completed work.
14. Commit locally, then ask before pushing — same pattern as every prior phase.

## 5. Where things stand

**Not done:** essentially all of Phase 9 except the very first slice of model changes described in section 3. **Not committed.** `origin/main` unaffected, still at `2581006`.

**Fastest way to resume:** read this file in full (not just skim), confirm `git status` still matches section 3 exactly, then continue at step 2 of section 4.
