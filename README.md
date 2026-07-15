# AccessFlow

Enterprise Identity & Access Management (IAM) platform — permission-based RBAC, built as a portfolio-quality, production-grade system with a frontend-agnostic API.

Full specification: [doc_files/00_AI_MASTER_INSTRUCTIONS_AccessFlow.md](doc_files/00_AI_MASTER_INSTRUCTIONS_AccessFlow.md)

## Repository layout

```
AccessFlow/
├── backend/            # Node.js + Express + MongoDB API (frontend-agnostic)
├── frontend-react/      # added starting Phase 4
├── frontend-angular/    # added starting Phase 4
├── frontend-vue/        # added starting Phase 4
└── frontend-nextjs/     # added starting Phase 4
```

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Authentication | Complete — see [backend/Phase-01.md](backend/Phase-01.md) |
| 2 | Users / Roles / Permissions CRUD | Not started |
| 3 | Authorization Middleware | Not started |
| 4 | Protected UI | Not started |
| 5 | Audit Logs | Not started |
| 6 | Permission Simulator | Not started |
| 7 | Advanced RBAC | Not started |
| 8 | ABAC + Multi-tenant | Not started |

## Getting started

See [backend/README.md](backend/README.md) for backend setup and API details.
