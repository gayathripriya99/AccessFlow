# AccessFlow: Complete Architecture & Demonstration Guide

---

## 1. Executive Summary

**AccessFlow** is a portfolio-grade, enterprise Identity and Access Management (IAM) and Access Governance platform. It addresses the real-world complexity of multi-tenant enterprise authorization by combining **Hierarchical Role-Based Access Control (RBAC)** with **Attribute-Based Access Control (ABAC)**, end-to-end multi-tenant data isolation, diagnostic simulation, and immutable audit logging.

### High-Level Tech Stack
- **Backend:** Node.js, Express, TypeScript, Zod, MongoDB, Mongoose, Pino Logger, Jest.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Axios, i18next (English, Hindi, Kannada, French).
- **Security:** Dual-token JWT (in-memory access token + httpOnly rotating refresh token), token reuse detection, automatic session revocation.

---

## 2. Core Architectural Pillars

```
HTTP Request
     │
     ▼
Route Middleware (requireAuth ➔ requireAccess / requirePermission ➔ validateRequest)
     │
     ▼
Controllers (HTTP transport, status codes, response serialization)
     │
     ▼
Services (Business logic, token rotation, cycle detection, ABAC evaluation)
     │
     ▼
Repositories (Direct Mongoose queries scoped by tenantId)
     │
     ▼
MongoDB (Tenants, Users, Roles, Permissions, Policies, AuditLogs, RefreshTokens)
```

### 1. Multi-Tenancy (Phase 9)
- **Data Isolation:** Every tenant-scoped model (`User`, `Role`, `Permission`, `Policy`, `AuditLog`) carries a mandatory, indexed `tenantId` referencing the `Tenant` document.
- **Repository Guarantee:** All repository query methods require `tenantId` as their first parameter, preventing cross-tenant data leaks at compile time.
- **Scoped Uniqueness:** Compound unique indexes (`{ tenantId: 1, name: 1 }` and `{ tenantId: 1, email: 1 }`) ensure organization-level uniqueness without blocking the same email or role name from existing in another organization.
- **Registration Flow:**
  - `mode: 'create'`: Generates a new tenant, seeds default permissions and policies, and designates the registrant as the bootstrap administrator.
  - `mode: 'join'`: Joins an existing organization by slug with no initial roles.

### 2. Permissions as Atomic Source of Truth (Phase 3)
- **Golden Rule:** Authorization logic **never** checks `role === 'admin'`.
- Access is determined solely by evaluating atomic permission strings (e.g., `users.read`, `roles.create`, `auditlogs.read`).
- Users possess roles; roles aggregate permissions. Authorization middleware resolves the flattened, inherited permission set for each request.

### 3. Hierarchical RBAC (Phase 7)
- Roles can define a self-referencing `parentRole`.
- Child roles automatically inherit all permissions granted to their ancestor chain transitively.
- **Cycle Detection:** `RoleRepository.wouldCreateCycle` uses depth-first traversal to block cyclic inheritance (e.g., Role A ➔ Role B ➔ Role A) before saving.
- **Safe Cascade:** Deleting a parent role nullifies references in child roles rather than leaving dangling pointers.

### 4. Attribute-Based Access Control (ABAC) (Phase 8)
- Policies sit alongside RBAC and are enforced via `requireAccess(resource, action, fallbackPermission)`.
- **Precedence Rule:**
  1. If any matching policy has effect `deny`, access is denied (explicit Deny always wins).
  2. If any matching policy has effect `allow`, access is granted (even without the corresponding RBAC permission).
  3. If no policy matches, authorization falls back to standard RBAC permission checks.
- **Self-Service Safeguard:** Policies compare structured attributes (e.g., `resource.id == subject.id`). A self-service update allows users to modify their personal profile details (like display name) while explicitly preventing them from escalating their own roles.

### 5. Enterprise Session Security (Phases 1 & 4)
- **Access Tokens:** Short-lived JWTs held strictly in memory in the React client (mitigating XSS extraction).
- **Refresh Tokens:** High-entropy JWTs stored as SHA-256 hashes in MongoDB, delivered through secure, `httpOnly` cookies with `SameSite` protection.
- **Reuse Detection:** If an invalidated or rotated refresh token is presented, the system treats the session as compromised and immediately purges all active refresh tokens for that user.
- **Instant Revocation:** Setting `isActive: false` on a user takes effect immediately on their next request, even if their access token JWT is unexpired.

### 6. Permission Simulator (Phase 6)
- Pure, idempotent read diagnostic endpoint (`POST /api/v1/simulator/check`).
- Evaluates whether a specific permission would be granted to an existing user or a proposed set of roles.
- Returns the boolean decision, the exact role(s) responsible for granting it, and the full resolved permission list without mutating the database.

### 7. Immutable Audit Logs (Phase 5)
- Tracks all authentication events (`AUTH_LOGIN`, `AUTH_LOGOUT`, `TOKEN_ROTATED`, `REUSE_DETECTED`) and administrative mutations (`USER_CREATED`, `ROLE_UPDATED`, etc.).
- Sortable, paginated, and filterable by action, actor, and date range.

---

## 3. Step-by-Step Testing Guide with 2 Users

### Test Setup: The Two Personas
1. **Persona A: Bootstrap Admin**
   - **Role:** `admin` (has all 17 baseline system permissions)
   - **Access:** Can access and manage all pages (Users, Roles, Permissions, Audit Logs, Policies, Simulator).
2. **Persona B: Standard Team Member**
   - **Role:** Roleless upon registration
   - **Access:** Limited to viewing their profile and dashboard; admin pages are gated.

---

### Step-by-Step Walkthrough

#### Step 1: Login as Organization Admin
1. Open **`http://localhost:5173/login`**.
2. Enter your Organization Slug, Admin Email, and Password.
3. Click **Sign in**.
4. **Verification:**
   - Navigates to the Dashboard.
   - The sidebar displays: **Users**, **Roles**, **Permissions**, **Audit Logs**, **Policies**, and **Permission Simulator**.
   - Language switcher in the navbar toggles between English, Hindi, Kannada, and French.

#### Step 2: Manage Users
1. Click **Users** in the sidebar.
2. View the table of registered members within the current tenant.
3. Click **Edit** on your second user:
   - Assign roles or toggle account status (`Active` / `Inactive`).
   - Notice that if deactivated, the member is blocked from accessing API resources immediately.

#### Step 3: Test Role Inheritance
1. Navigate to **Roles**.
2. Click **Create Role**:
   - Name: `lead-auditor`
   - Permissions: `auditlogs.read`, `users.read`
3. Click **Create Role** for a second role:
   - Name: `senior-auditor`
   - Parent Role: `lead-auditor`
   - Additional Permission: `simulator.run`
4. The system transitively grants `senior-auditor` both its direct permissions and all inherited permissions from `lead-auditor`.

#### Step 4: Run the Permission Simulator
1. Navigate to **Permission Simulator**.
2. Under **Mode**, choose either a real user or hypothetical roles.
3. Select `users.read` and run the simulation.
4. **Observation:**
   - Displays `Allowed: Yes`.
   - Explicitly cites which role granted the permission (direct or inherited).

#### Step 5: Test Non-Admin Restrictions & ABAC
1. Log out and sign in as the **Standard Member**.
2. **Observations:**
   - Administrative navigation links are hidden from the sidebar via `<PermissionGate>`.
   - Directly navigating to `/roles` or `/permissions` renders the access-denied state (`Forbidden` / 403).
3. **Self-Service Profile Edit:**
   - The user can update their own name because the ABAC policy `self-service-update` matches `resource.id == subject.id`.
   - Any attempt to modify role IDs is rejected by backend business logic.

#### Step 6: Verify Audit Trail
1. Sign back in as **Admin** and open **Audit Logs**.
2. Inspect the immutable log entries generated by the steps above (e.g., login records, role assignments, profile updates).

---

## 4. Key Interview Explanations & Answers

### Q: Why not just store the role name inside the JWT access token?
> **Answer:** Storing roles inside the JWT makes role updates stale until the token expires. More importantly, it encourages checking `if (user.role === 'admin')` in code. In AccessFlow, the JWT only proves identity (`sub`, `tenantId`). Permissions are resolved server-side against the role hierarchy on each request, allowing role revoking or user deactivation to take effect instantly without waiting for JWT expiration.

### Q: How do you prevent multi-tenant data leaks?
> **Answer:** We enforce tenant separation at both the database and service layers. Every model carries a required `tenantId`, and queries use compound indexes like `{ tenantId: 1, email: 1 }`. At the code level, all repository methods require `tenantId` as their primary argument. When a request arrives, authentication binds `tenantId` from the verified token directly into the request context (`req.auth.tenantId`).

### Q: How does refresh token reuse detection work?
> **Answer:** Refresh tokens are signed JWTs containing a unique `jti` identifier. The SHA-256 hash of this `jti` is stored in the database. When a refresh token is exchanged, it is immediately flagged as rotated/used. If an attacker and a legitimate client both attempt to submit the same rotated refresh token, the server identifies the duplicate submission as token theft, invalidates all sessions associated with that user ID, and logs a security audit event (`AUTH_REUSE_DETECTED`).

### Q: What is the difference between RBAC and ABAC in this project?
> **Answer:** RBAC governs broad permissions linked to organization responsibilities (e.g., `users.create`, `roles.read`). ABAC provides fine-grained contextual control, evaluating attributes of the user and the target resource (e.g., `resource.id == subject.id`). In AccessFlow, our `requireAccess` middleware evaluates ABAC policies first, allowing explicit Deny rules to supersede all permissions, and falls back to RBAC when no specific policy applies.

---

## 5. Local Development Commands Reference

| Task | Command | Directory |
| :--- | :--- | :--- |
| **Start Backend API** | `npm run dev` | `backend/` |
| **Run Backend Tests** | `npm test` | `backend/` |
| **Run Specific Test** | `npx jest tests/auth.test.ts` | `backend/` |
| **Build Backend** | `npm run build` | `backend/` |
| **Start Frontend** | `npm run dev` | `frontend-react/` |
| **Build Frontend** | `npm run build` | `frontend-react/` |
