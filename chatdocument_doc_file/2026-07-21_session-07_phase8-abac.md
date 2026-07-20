# Session 07 — 2026-07-21

**Scope of this session:** Continued from session 06 to build Phase 8 (ABAC), scoped down from the original "ABAC + Multi-tenant" by explicit user decision.

> How to use this file: if you say "refer that chat and continue from where you stopped," this is (currently) the last file in the series — read it, then `backend/Phase-08.md`, then session 06 before it for full history.

---

## 1. Continuation and scoping

Standard resume idiom ("please continue referring to doc file," repeated). Re-verified `git log`/`git status` matched session 06's pause point (`1515f33`, clean tree) first.

Per the established README ordering, the next phase was **Phase 8: ABAC + Multi-tenant** — the last one on the original roadmap. Unlike Phases 5–7, this one was flagged before starting rather than scoped silently: it bundles two large, separate architectural concerns, and multi-tenant in particular would be structurally invasive in a way nothing so far has been (a `tenantId` on every model, every existing query needing tenant-scoping, uniqueness constraints going from global to per-tenant, a JWT claim, all 54 existing tests touched). Asked the user how to scope it rather than assume; **the user chose ABAC only**, deferring multi-tenant.

ABAC itself still needed scoping — `doc_file` doesn't define it either, same gap as every prior ambiguous phase name. The domain has no natural "owned resource" (Permissions/Roles are global config, not owned; Users don't have an owner other than themselves), so the design settled on **self-service identity comparison** (`resource.id == subject.id`) as the one meaningful attribute relationship that actually exists here — a real, standard ABAC pattern (AWS IAM's `aws:userid` condition keys work the same way), not an invented example.

## 2. What was built

Backend: a full `Policy` CRUD resource (4 new baseline permissions, bringing the count to 17) plus `AbacService` (allow/deny/indeterminate evaluation, deny-always-wins) and a new `requireAccess` middleware that checks ABAC before falling back to RBAC. Wired onto the three single-resource Users routes only (list stays RBAC-only — no single id to evaluate against). Three policies seeded idempotently at first-user bootstrap, alongside the baseline permissions: self-service read, self-service update, and a **deny** policy blocking self-deletion even for admins — deliberately included to demonstrate deny-overrides-allow with a real, useful rule, not just an allow-only feature.

The one piece of real security design in this phase: `UserService.update` restricts a self-service update reaching it via the ABAC grant (not real `users.update`) to the `name` field only. Without this, "update your own profile" would double as "grant yourself any role" — the whole point of RBAC would be defeated by its own escape hatch. This was designed in up front, not discovered as a bug afterward.

Frontend: a `PoliciesPage` with full CRUD and a small repeatable conditions editor, following the same list/form pattern as every prior resource page.

Full technical detail is in `backend/Phase-08.md` — not duplicated here.

## 3. Verification — clean pass, one intentional test update

`build`/`lint`/`test` initially surfaced one failure: `users.test.ts`'s existing "rejects a non-admin with 403" test PATCHed the caller's own id as its negative case — which the new self-service-update policy now correctly *allows* (name-only). This wasn't a regression; it was the old test's assumption becoming wrong on purpose, by design. Fixed by retargeting that test at a genuinely different user, which still correctly 403s, and left the assumption change explicit in the test's own comment rather than silently editing it. Final count: 63/63 (54 pre-existing unchanged, 9 new, 1 updated).

Full Playwright browser pass followed (same approach as Phases 4–7, using `context.request` for setup calls that aren't the feature under test): confirmed the 3 seeded policies exist after bootstrap; a permission-less user could view their own profile via the real API but not another's; the same user could rename themself but was rejected attempting to grant themself a role or reactivate/deactivate themself; a user granted `users.delete` via a role could delete someone else but not themself (the deny policy winning over a real RBAC grant, the specific case this phase was built to demonstrate); disabling the self-read policy through the UI immediately removed that user's own-profile access, proving live evaluation rather than caching; a non-admin's nav hides the Policies link and a direct URL 403s. Every check passed — the only issues hit during verification were test-script row-scan timing (the same recurring class fixed in Phases 4 and 7: an explicit `waitFor` on a known table cell before scanning rows after a client-side nav), not application bugs. The recurring auth-rate-limiter-exhaustion gotcha also hit again mid-session and was resolved the same documented way.

## 4. Docs

`backend/Phase-08.md` (new) — leads with the scope-decision explanation before anything else, since that's the most important context for anyone picking this phase up cold. `README.md` — Phase 8 row marked Complete with an explicit note that multi-tenant was deferred, plus a new "8b" row for it so the gap doesn't get silently lost. `CLAUDE.md` — phase-complete line, permission count (13→17) in multiple places, a new RBAC-rules bullet describing ABAC's precedence and the field-restriction guard, `requireAccess` added to the middleware list, `Policy` added to the `toJSON` schema list. `backend/README.md` — new `/api/v1/policies` API-summary section, the `/api/v1/users` section rewritten to note which routes are ABAC-first now and why, `policies` collection added to the Database section, test count and suite list updated.

## 5. Where things stand / next steps

**Done:** Phases 1–8 (ABAC only; multi-tenant explicitly not part of Phase 8). Not yet committed as of the end of this section — that's the next step, followed by asking whether to push (per the established pattern).

**Not done yet:** multi-tenant (deferred, fully unstarted — would need its own phase), Permission Simulator not ABAC-aware (deliberately out of scope this phase), ABAC only supports the `user` resource (no other resource has ownership/attribute data yet), no automated frontend tests, no `userId`-filter picker on the audit log page (Phase 5, still open), `frontend-angular`/`frontend-vue`/`frontend-nextjs` don't exist, the roadmap-reorder question remains formally unresolved, no CI/CD or deployment.

**Fastest way to resume:** read this file, then `backend/Phase-08.md`, confirm `git log`/`git status` still match (re-verify, don't assume), then ask the user what's next — likely candidates are multi-tenant as its own phase, frontend tests, or resolving the roadmap-reorder question, since the original 8-phase roadmap (ABAC portion) is now complete.
