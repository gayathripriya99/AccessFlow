# Phase 05 — Audit Logs (query/viewing API + UI)

## Objectives completed

- Query/viewing side of the audit trail: `GET /api/v1/audit-logs`, gated on a new baseline permission (`auditlogs.read`), filterable by `action`, `userId`, and a `from`/`to` date range, paginated, sorted newest-first. The write side already existed since Phase 1/2 (`AuditLogRepository.record`, called from `AuthService` and every Permission/Role/User mutation) — this phase only adds reading it back.
- `frontend-react/src/pages/AuditLogsPage.tsx` — read-only list (no create/edit/delete; audit entries are system-generated) with the same action/date filters as the API, reusing the existing `DataTable`/`Pagination`/`ErrorState`/`FormField` components rather than introducing new ones.
- New baseline permission `auditlogs.read`, added to `SYSTEM_PERMISSIONS` — the admin-bootstrap set is now 12 permissions, not 11 (see "Files modified" for every place that count was previously hardcoded).
- Nav: `Audit Logs` added to `NAV_ITEMS` (`src/config/navigation.ts`), so it shows up in both Sidebar and the mobile drawer automatically, permission-filtered like every other item.

## Design decisions worth knowing before touching this code

- **`userId` is always populated on this list** (`{id, name, email}`), unlike Permission/Role's list views (unpopulated id arrays, by design — see `backend/Phase-04.md`). The rationale is the opposite one: an audit log's entire purpose is showing *who* did something, so populating on every entry is the correct default here, not a perf shortcut to avoid.
- **Sort is newest-first** (`createdAt: -1`), not alphabetical like Permission/Role. An audit trail is inherently chronological; alphabetical would be actively wrong.
- **No `search` filter** — Permission/Role/User lists have a free-text `search` because they have a `name` field to search. Audit log entries don't; the filter set is `action` (exact match against the `AUDIT_ACTIONS` enum), `userId` (exact match), and `from`/`to` (date range on `createdAt`) instead.
- **`AUDIT_ACTIONS` is now a runtime array, not just a TypeScript union type** (`backend/src/models/AuditLog.ts`) — the `action` filter needs something to validate against at runtime (`z.enum(AUDIT_ACTIONS)`), so the type is now derived from the array (`type AuditAction = (typeof AUDIT_ACTIONS)[number]`) instead of the array being absent. The frontend (`src/api/types.ts`) keeps its own copy of the same list for the filter dropdown — small, static, rarely-changing enough that duplicating it beats fetching it from an endpoint that doesn't otherwise need to exist.
- **`metadata` can legitimately be absent from a response**, not just `{}` — see the "Real bug found" section below. Never assume it's present when rendering.

## Real bug found (by actually running this in a browser, not just tests)

`AuditLog.metadata` is a `Schema.Types.Mixed` field defaulting to `{}`. Mongoose's schema-level default `minimize: true` strips empty-object fields before saving — so any action that never passes explicit metadata to `AuditLogRepository.record()` (which is most of them: `auth.register`, `auth.login.success`, `auth.refresh`, `auth.logout` — only `auth.login.failure` and the Permission/Role/User mutation events pass metadata) ended up with the field **missing from storage entirely**, not `{}`. The frontend's `Object.keys(row.metadata)` crashed the first time `AuditLogsPage` was actually rendered against real data — the backend test suite never caught it because none of its assertions read `metadata` off a register/login entry specifically.

Fixed two ways:
1. **Root cause**: `minimize: false` added to `AuditLog`'s schema options, so `metadata: {}` is now genuinely persisted for every new document going forward — the documented `metadata: Record<string, unknown>` contract (non-optional) is honored.
2. **Defensive read**: the frontend's `AuditLogEntry.metadata` type was also marked optional and `AuditLogsPage`'s render guards with `row.metadata &&` — reading across an API boundary is exactly where `CLAUDE.md`'s "only validate at system boundaries" guidance says a defensive check like this belongs, independent of the backend fix (which only protects *new* rows going forward, not any hypothetical rows written before this fix in a real deployment).

A backend regression test (`auditLog.test.ts`) now asserts `metadata` is `{}` on an entry that never passed it explicitly, to keep this fixed.

## Files created

```
backend/src/
├── validators/auditLog.validators.ts    query-param validation (page/limit/action/userId/from/to)
├── services/AuditLogService.ts          thin pagination wrapper, mirrors PermissionService
├── controllers/AuditLogController.ts    HTTP-only, mirrors PermissionController
└── routes/v1/auditLog.routes.ts         GET / only — no create/update/delete route exists

backend/tests/auditLog.test.ts           401/403, list+populate+sort, filter by action/userId/date,
                                          pagination, invalid-filter 400s, the metadata regression guard

frontend-react/src/
├── api/auditLogs.ts                     listAuditLogs()
└── pages/AuditLogsPage.tsx              filter controls + DataTable + Pagination + ErrorState
```

## Files modified

- `backend/src/models/AuditLog.ts` — `AuditAction` is now derived from a new exported `AUDIT_ACTIONS` runtime array; added `toJSON: toJSONOptions` (this model's documents are now serialized directly to clients for the first time) and `minimize: false` (see the bug above).
- `backend/src/repositories/AuditLogRepository.ts` — added `list(filter, pagination)`: builds a Mongo filter from `action`/`userId`/`from`/`to`, sorts `createdAt: -1`, populates `userId` with `name email`.
- `backend/src/constants/systemPermissions.ts` — added `auditlogs.read`. Baseline permission count is now **12**, not 11.
- `backend/src/routes/v1/index.ts` — mounts the new router at `/audit-logs`.
- `backend/tests/auth.test.ts` — the hardcoded `expect(res.body.data.permissions).toHaveLength(11)` on the bootstrap-admin `/auth/me` assertion updated to `12`.
- `frontend-react/src/api/types.ts` — added `AUDIT_ACTIONS`, `AuditAction`, `AuditLogEntry`.
- `frontend-react/src/config/navigation.ts` — added the `auditLogs` entry (permission: `auditlogs.read`).
- `frontend-react/src/App.tsx` — added the `audit-logs` route, wrapped in `RequirePermission`, same pattern as Users/Roles/Permissions.
- `frontend-react/src/i18n/locales/{en,hi,kn,fr}.json` — added `nav.auditLogs` and the full `auditLogs.*` key group, to all 4 files together.
- `CLAUDE.md` — permission count references (11→12), repository-layout description (Sidebar/ErrorState/NotFoundPage/`config/navigation.ts` were missing from Phase 4's original write-up too, folded into this update), the `minimize`/Mixed-field gotcha.

## Verification

- `cd backend && npm run build && npm run lint && npm test` — clean; 38/38 tests passing (30 pre-existing + 8 new in `auditLog.test.ts`).
- `cd frontend-react && npm run build && npm run lint` — clean (same one pre-existing harmless `react-refresh` warning as every prior phase).
- **Live browser verification** (Playwright, same approach as Phase 4's round 3 — real `npm run dev` backend+frontend, real local MongoDB, reset empty beforehand): registered a first (admin) user, confirmed the Sidebar shows "Audit Logs" and the list shows `auth.register`/`auth.login.success` with the actor's name+email populated, newest-first; filtered by `action=auth.register` (1 row) and by a future `from` date (empty state); registered a second, permission-less user and confirmed the nav link is hidden and a direct `/audit-logs` URL gives a real 403. This is the pass that caught the `metadata` bug above — fixed, then the entire sequence re-run end-to-end to confirm.

## Remaining work (next phases)

- Phase 6: Permission Simulator.
- Phase 7: Advanced RBAC.
- Phase 8: ABAC + multi-tenant.
- No `userId` filter UI on `AuditLogsPage` — the API supports it, but there's no user-picker component yet to drive it from; low priority since `action`+date range already covers the common cases.
- Still no automated frontend tests (`*.test.tsx`); Playwright is available as a devDependency (added in Phase 4 round 3) if an E2E suite is ever written instead of/alongside RTL.
- The user's proposed roadmap reorder (Dashboard/Analytics before Audit Logs, etc.) was explicitly not adopted for this phase — Audit Logs was chosen as the literal next phase per the existing README ordering, confirmed with the user before starting.
