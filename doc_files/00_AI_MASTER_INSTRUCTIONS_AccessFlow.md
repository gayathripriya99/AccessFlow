# AccessFlow – AI Master Instructions

> **Purpose:** This document is the master instruction file for AI assistants (Claude/ChatGPT/Codex) to build **AccessFlow**, a production-ready Enterprise Identity & Access Management (IAM) platform.

---

# 1. Project Vision

Build a **portfolio-quality**, enterprise-grade RBAC/IAM application.

The output must be production-ready, maintainable, scalable, secure, responsive, and well documented.

---

# 2. Tech Stack

## Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT + Refresh Tokens
- bcrypt

## Frontend Clients
- React
- Angular
- Vue
- Next.js

> The backend **must remain frontend-agnostic**. All four frontend clients consume the same API.

Repository layout:

```text
AccessFlow/
├── backend/
├── frontend-react/
├── frontend-angular/
├── frontend-vue/
└── frontend-nextjs/
```

---

# 3. Responsive UI

Support:

- Desktop
- Laptop
- Tablet
- Android
- iPhone
- Foldables
- Portrait
- Landscape

Breakpoints:

- 320
- 375
- 425
- 768
- 1024
- 1280
- 1440
- 1920+

Use:

- CSS Grid
- Flexbox
- Responsive typography
- Accessible components

---

# 4. Internationalization (i18n)

Support these languages:

- English
- Hindi
- Kannada
- French

Requirements:

- No hardcoded UI text.
- Translation files only.
- Language dropdown updates UI instantly.

---

# 5. Clean Architecture

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
MongoDB
```

Business logic **must not** exist inside controllers.

---

# 6. Core Modules

- Authentication
- Users
- Roles
- Permissions
- Audit Logs
- Dashboard
- Permission Simulator
- Profile
- Settings

---

# 7. RBAC Rules

- Permissions are the source of truth.
- Users may have multiple roles.
- Roles contain permissions.
- Never check `role == "Admin"` directly.
- Always evaluate permissions.

---

# 8. Coding Standards

- SOLID
- DRY
- KISS
- Reusable components
- Environment variables
- Validation
- Error handling
- Logging
- Pagination
- Filtering
- API versioning

---

# 9. Security

- JWT
- Refresh Tokens
- Password hashing
- Rate limiting
- Secure headers
- Audit logging
- Input validation

---

# 10. Documentation

Every completed feature must include:

- README
- API summary
- Database changes
- Components created
- Pending tasks

---

# 11. AI Development Workflow

The AI must **never** generate the entire project in one response.

Instead build in phases:

## Phase 1
Authentication

## Phase 2
Users / Roles / Permissions CRUD

## Phase 3
Authorization Middleware

## Phase 4
Protected UI

## Phase 5
Audit Logs

## Phase 6
Permission Simulator

## Phase 7
Advanced RBAC

## Phase 8
ABAC + Multi-tenant

---

# 12. End of Every Chat

Always generate a markdown summary named:

`Phase-XX.md`

Include:

- Objectives completed
- Files created
- APIs added
- Database updates
- Components
- Tests
- Remaining work

This allows development to continue across multiple chats without losing context.

---

# 13. AI Role

Always act as:

- Senior Software Architect
- Senior Frontend Engineer
- Senior Backend Engineer
- Senior UI/UX Designer
- Senior DevOps Engineer
- Senior QA Engineer
- Senior Security Engineer

Produce production-quality code suitable for a professional portfolio.
