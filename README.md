# AccessFlow

Enterprise Identity & Access Management (IAM) platform — permission-based RBAC, built as a portfolio-quality, production-grade system with a frontend-agnostic API.

Master spec: [doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md](doc_file/00_AI_MASTER_INSTRUCTIONS_PRO.md)

## Repository layout

```
AccessFlow/
├── backend/            # Node.js + Express + MongoDB API (frontend-agnostic)
├── frontend-react/      # Phase 4 — React protected UI
├── frontend-angular/    # not yet built
├── frontend-vue/        # not yet built
└── frontend-nextjs/     # not yet built
```

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Authentication | Complete — see [backend/Phase-01.md](backend/Phase-01.md) |
| 2 | Users / Roles / Permissions CRUD | Complete — see [backend/Phase-02.md](backend/Phase-02.md) |
| 3 | Authorization Middleware | Complete — see [backend/Phase-03.md](backend/Phase-03.md) |
| 4 | Protected UI (React) | Complete — see [backend/Phase-04.md](backend/Phase-04.md) |
| 5 | Audit Logs | Complete — see [backend/Phase-05.md](backend/Phase-05.md) |
| 6 | Permission Simulator | Complete — see [backend/Phase-06.md](backend/Phase-06.md) |
| 7 | Advanced RBAC (Role Hierarchy) | Complete — see [backend/Phase-07.md](backend/Phase-07.md) |
| 8 | ABAC | Complete — see [backend/Phase-08.md](backend/Phase-08.md). Scoped to ABAC only; multi-tenant deferred (see that doc) |
| 8b | Multi-tenant | Not started |

## Getting started

See [backend/README.md](backend/README.md) for backend setup and API details.
