# AccessFlow: Complete Flow Diagrams

This document contains visual diagrams for every architectural flow in the system.

---

## 1. End-to-End Request & Security Lifecycle Flow

```mermaid
flowchart TD
    %% FRONTEND
    subgraph Frontend ["1. Frontend (React 18)"]
        UserAction([User Action / Page Click]) --> GetToken{In-Memory Access Token?}
        GetToken -->|Present| AxiosHeader[Attach: Authorization Bearer JWT]
        GetToken -->|Expired / None| SilentRefresh[POST /auth/refresh with httpOnly Cookie]
        SilentRefresh --> AxiosHeader
        AxiosHeader --> SendReq[Send HTTP Request]
    end

    %% BACKEND ENTRY & AUTH
    subgraph AuthLayer ["2. Authentication Middleware (requireAuth)"]
        SendReq --> RateLimit{Rate Limiter OK?}
        RateLimit -->|Exceeded| Err429[429 Too Many Requests]
        RateLimit -->|Pass| VerifyJWT{Verify Access Token Signature}
        VerifyJWT -->|Invalid / Expired| Err401[401 Unauthorized]
        VerifyJWT -->|Valid| CheckActive{User isActive in DB?}
        CheckActive -->|false| Err403Inactive[403 Forbidden: Account Inactive]
        CheckActive -->|true| Context[Attach req.auth: userId & tenantId]
    end

    %% AUTHORIZATION (ABAC + RBAC)
    subgraph AuthZLayer ["3. Authorization Middleware (requireAccess)"]
        Context --> EvalABAC{Evaluate ABAC Policies}
        
        %% ABAC
        EvalABAC -->|Explicit DENY match| Err403Deny[403 Forbidden: Deny Policy Wins]
        EvalABAC -->|ALLOW match e.g. self-service| AccessGranted[Access Granted]
        EvalABAC -->|No policy matched| EvalRBAC[Fallback to RBAC Check]

        %% RBAC
        EvalRBAC --> GetRoles[Fetch User Assigned Roles]
        GetRoles --> WalkChain[Walk Ancestor Hierarchy: parentRole]
        WalkChain --> Flatten[Flatten All Inherited Permissions]
        Flatten --> HasPerm{Has Atomic Permission?}
        HasPerm -->|No| Err403Perm[403 Forbidden: Missing Permission]
        HasPerm -->|Yes| AccessGranted
    end

    %% BUSINESS LOGIC & TENANT ISOLATION
    subgraph BackendCore ["4. Core Service & Tenant Isolation"]
        AccessGranted --> Controller[Controller parses input]
        Controller --> Service[Service executes Business Logic]
        Service --> Repo[Repository queries DB with mandatory tenantId]
        Repo --> MongoDB[(MongoDB: Scoped by tenantId)]
        MongoDB --> AuditLog[Write event to AuditLog collection]
        AuditLog --> Response[Serialize Response: strip _id & __v]
    end

    Response --> UIUpdate([Frontend updates state & renders view])
```

---

## 2. JWT Dual-Token Authentication & Silent Refresh Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant React as React App (In-Memory)
    participant API as Express Backend
    participant DB as MongoDB

    Note over User,DB: Initial Login
    User->>React: Enters Email, Password & Tenant Slug
    React->>API: POST /api/v1/auth/login
    API->>DB: Verify credentials & tenant
    API->>API: Generate Access Token (JWT, 15m) & Refresh Token (JWT, 7d)
    API->>DB: Store SHA-256 hash of refresh token
    API-->>React: Body: { accessToken } + Cookie: refreshToken (httpOnly)
    React->>React: Store accessToken in JavaScript memory

    Note over User,DB: Normal Authorized API Call
    React->>API: GET /api/v1/users (Header: Bearer <accessToken>)
    API->>API: requireAuth verifies signature
    API-->>React: 200 OK with data

    Note over User,DB: Silent Token Refresh (After 15 minutes)
    React->>API: GET /api/v1/users (Expired Token)
    API-->>React: 401 Unauthorized
    React->>API: POST /api/v1/auth/refresh (Sends httpOnly cookie automatically)
    API->>DB: Verify refresh token hash & rotate token
    API-->>React: 200 OK: New Access Token + New httpOnly Cookie
    React->>API: Replays original GET /api/v1/users (Seamless retry)
    API-->>React: 200 OK with data
```

---

## 3. Two-Tier Authorization Engine Flow (ABAC + RBAC)

```mermaid
flowchart TD
    Start([Incoming Route with requireAccess]) --> Step1[Fetch Applicable ABAC Policies for Resource & Action]
    
    Step1 --> Step2{Check Policy Effects}
    Step2 -->|Any condition matches DENY| DenyOut[RETURN 403 FORBIDDEN: Deny overrides everything]
    Step2 -->|Any condition matches ALLOW e.g. self-service| AllowOut[RETURN ALLOW: Access Granted without RBAC]
    Step2 -->|No matching policy| Step3[Fallback to RBAC Engine]

    subgraph RBAC Engine ["RBAC Permission Resolution"]
        Step3 --> FetchRoles[Fetch User Roles: User.roles]
        FetchRoles --> Traverse[RoleRepository: Traverse parentRole hierarchy]
        Traverse --> Union[Union direct permissions + all ancestor permissions]
        Union --> CheckName{Target permission in resolved set?}
        CheckName -->|Yes| AllowOut
        CheckName -->|No| DenyOut
    end
```

---

## 4. Role Hierarchy & Inheritance Flow

```mermaid
flowchart TD
    subgraph RoleHierarchy ["Inheritance Chain"]
        RoleAdmin["Director Role (Permissions: system.manage)"]
        RoleManager["Manager Role (Permissions: users.update, roles.read)"]
        RoleDev["Developer Role (Permissions: code.write, code.read)"]

        RoleAdmin -->|parentRole| RoleManager
        RoleManager -->|parentRole| RoleDev
    end

    subgraph EffectivePermissions ["Resolved Effective Permissions for Director"]
        Effective["Effective Permissions for Director:
        - system.manage (Direct)
        - users.update (Inherited from Manager)
        - roles.read (Inherited from Manager)
        - code.write (Inherited from Developer)
        - code.read (Inherited from Developer)"]
    end

    RoleAdmin -. Evaluated by Simulator & Authorization Engine .-> Effective
```

---

## 5. Multi-Tenant Scoping & Database Isolation Flow

```mermaid
flowchart LR
    subgraph ClientRequest ["Incoming Multi-Tenant Request"]
        Req[Request with JWT] --> TokenData["JWT Payload:
        { sub: 'user_123', tenantId: 'tenant_abc' }"]
    end

    subgraph Middleware ["Middleware Injection"]
        TokenData --> ContextInject["req.auth = { userId, tenantId }"]
    end

    subgraph RepoLayer ["Repository Enforcement"]
        ContextInject --> RepoCall["UserRepository.findById(tenantId, userId)
        RoleRepository.findAll(tenantId)
        PermissionRepository.findAll(tenantId)"]
    end

    subgraph Database ["MongoDB Isolation"]
        RepoCall --> CompoundQuery["MongoDB executes query:
        { tenantId: 'tenant_abc', _id: ... }
        Enforced by compound index: { tenantId: 1, name: 1 }"]
    end
```
