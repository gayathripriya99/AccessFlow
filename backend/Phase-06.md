# Phase 06 — Permission Simulator

## Objectives completed

- `POST /api/v1/simulator/check` — given either a real user or a hypothetical set of roles, and a permission name, returns whether that permission would be granted, which role(s) grant it, and the full resolved permission set. Purely a diagnostic read: no state is ever mutated, nothing is actually granted.
- Gated on a new baseline permission, `simulator.run` — the admin-bootstrap set is now **13** permissions, not 12.
- `frontend-react/src/pages/PermissionSimulatorPage.tsx` — a form (mode toggle, user/role selector, permission dropdown) plus a result panel (Allowed/Denied badge, granted-by roles, full resolved permission set), wired into nav/routing/i18n like every prior phase's page.
- Neither `doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md` nor any other doc specifies what a "Permission Simulator" should actually do — it's named in the README's phase table with no further detail. The design in this phase (two modes: check against a real user, or a hypothetical role selection with no user involved) is this session's own scoping, chosen because both are genuinely useful admin-diagnostic questions ("why can't this user do X" and "if I created a role with these permissions, would it cover Y").

## Design decisions worth knowing before touching this code

- **Two modes, one endpoint, a discriminated-union body** (`{ mode: 'user', userId, permission }` or `{ mode: 'roles', roleIds, permission }`) — not two separate endpoints. Both resolve to the same shape of work (gather roles → flatten permissions → check membership), so one Zod `discriminatedUnion` schema and one service with two thin entry methods (`simulateForUser`/`simulateForRoles`) funnelling into a shared private `resolve()` was simpler than duplicating the route/controller pair.
- **`userActive` is only present in the response for user-mode simulations.** A hypothetical role selection has no user to be active or inactive, so the field is simply absent (not `null`/`true`) — the frontend only renders the "this user is deactivated" warning when `userActive === false`, never when it's `undefined`.
- **A deactivated user always resolves to `allowed: false`**, even if their assigned roles would otherwise grant the permission — this mirrors `AuthorizationService.resolveAccess`'s real production behavior (deactivated users have zero effective access regardless of role assignments). The simulator still shows *which* roles would have granted it and the full resolved set, so an admin can see "this would work if the user were active," rather than just a bare, unexplained "no."
- **The permission being checked doesn't have to exist as a real `Permission` document.** The service just checks whether the target string appears in the flattened set of permission *names* attached to the resolved roles — an invented string simply won't be in that set (`allowed: false`), which is still a correct, meaningful answer. (The frontend's permission dropdown only offers real permissions, though, since simulating against a permission nobody could ever actually have is a much less useful UI default — the API is more permissive than the UI here on purpose.)
- **Not audit-logged.** Like every other list/read endpoint in this project (`GET /permissions`, `GET /audit-logs`, etc.), a simulation is a read with no side effect, so it doesn't write an audit entry — only mutations do.

## Files created

```
backend/src/
├── validators/simulator.validators.ts   discriminated-union body schema
├── services/SimulatorService.ts         simulateForUser / simulateForRoles / private resolve()
├── controllers/SimulatorController.ts   HTTP-only, dispatches on body.mode
└── routes/v1/simulator.routes.ts        POST /check only

backend/tests/simulator.test.ts          401/403, user-mode allow+deny+404+deactivated, roles-mode
                                          allow+400-unknown-id, input validation

frontend-react/src/
├── api/simulator.ts               simulate()
└── pages/PermissionSimulatorPage.tsx  mode toggle, user/role/permission selects, result panel
```

## Files modified

- `backend/src/constants/systemPermissions.ts` — added `simulator.run`. Baseline permission count is now **13**, not 12.
- `backend/src/routes/v1/index.ts` — mounts the new router at `/simulator`.
- `backend/tests/auth.test.ts` — the hardcoded bootstrap-admin permission-count assertion updated `12` → `13`.
- `frontend-react/src/api/types.ts` — added `SimulationResult`.
- `frontend-react/src/config/navigation.ts` — added the `simulator` entry (permission: `simulator.run`).
- `frontend-react/src/App.tsx` — added the `simulator` route, wrapped in `RequirePermission`.
- `frontend-react/src/i18n/locales/{en,hi,kn,fr}.json` — added `nav.simulator` and the full `simulator.*` key group, to all 4 files together.

## Verification

- `cd backend && npm run build && npm run lint && npm test` — clean; 47/47 tests passing (39 pre-existing + 8 new in `simulator.test.ts`).
- `cd frontend-react && npm run build && npm run lint` — clean (same one pre-existing harmless warning as every prior phase).
- **Live browser verification** (Playwright, same approach as Phases 4–5): bootstrapped an admin, created a custom permission + role bundling it, registered a second user and assigned that role via direct API calls (test setup, not the feature under test), then drove the actual simulator UI: self-check as admin (Allowed, granted by `admin`); the second user checking the permission their role grants (Allowed) and one it doesn't (Denied, "not granted by any of the selected roles" shown); deactivated that user and re-ran the same check (still Denied, now with the inactive-user warning); switched to roles mode with the same role selected hypothetically (Allowed, no inactive warning — confirming `userActive` really is mode-conditional, not just false-by-default); a third, roleless user's nav link is hidden and a direct `/simulator` URL gives a real 403. All checks passed; no bugs found by this pass (unlike Phases 4–5, which each caught one).
- Test artifacts (throwaway verify script, screenshots) deleted after use, dev servers stopped, DB left empty — same cleanup pattern as every prior session. This session's live-verification setup also used Playwright's `context.request` (an API context that shares the browser's cookie jar) to seed permission/role/user-assignment data directly via HTTP calls rather than driving those already-verified Phase 4/5 UIs again — faster, and keeps the browser-driven part of the script focused on the feature actually being tested.
- Hit the same auth-rate-limiter-exhaustion-needs-a-real-backend-restart gotcha as Phases 4–5 (repeated register/login calls across iterative script runs); resolved the same way (`netstat -ano | grep LISTENING` for the real PID, not `Get-NetTCPConnection`, which reported a stale one).

## Remaining work (next phases)

- Phase 7: Advanced RBAC.
- Phase 8: ABAC + multi-tenant.
- Still no automated frontend tests (`*.test.tsx`); Playwright remains available as a devDependency if an E2E suite is written.
- `frontend-angular`/`frontend-vue`/`frontend-nextjs` don't exist.
- The roadmap-reorder question remains unresolved — not revisited this session; the existing README ordering was used again without re-asking (already confirmed once for Phase 5, and the user's "continue doc_file" this session read as continuing in that same established order).
- No CI/CD or deployment configuration.
