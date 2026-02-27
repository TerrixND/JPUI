# Manager Staff Onboarding Rule API Usage

Last updated: 2026-02-27

This guide is only for manager endpoints:

- `POST /api/v1/manager/staff-onboarding/rules`
- `GET /api/v1/manager/staff-onboarding/rules`
- `PATCH /api/v1/manager/staff-onboarding/rules/:ruleId/revoke`

## 1) Authentication and Access

Required on all manager onboarding routes:

- `Authorization: Bearer <supabase_access_token>`
- authenticated app role must be `MANAGER`
- account status must be `ACTIVE`

Manager actor checks inside onboarding logic:

- must have claimed MANAGER permissions with `canCreateStaffRules=true`
- manager type cannot be `STANDALONE`
- manager must be assigned to at least one branch
- managers cannot create or manage `ADMIN` onboarding rules

Common error response format:

```json
{
  "message": "string",
  "code": "STRING",
  "stack": "string (non-production only)"
}
```

## 2) Create Rule

### Route

- `POST /api/v1/manager/staff-onboarding/rules`

### Expected Input Format (JSON)

```json
{
  "role": "MANAGER | SALES",
  "email": "staff@company.com",
  "phone": "+66812345678",
  "displayName": "required for SALES",
  "lineId": "optional",
  "note": "optional",
  "branchId": "optional UUID (auto-resolved in many manager cases)",
  "branchName": "not supported for manager route",
  "setAsPrimaryManager": false,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "permissions": {},
  "permission": {}
}
```

Input notes:

- use only one of `permissions` or `permission`
- `email` is required and normalized to lowercase
- `phone` is required and must be valid E.164 (example: `+14155552671`)
- `expiresAt` is optional, but if provided it must be a valid future datetime
- `branchId` must be a valid UUID when provided
- `branchName` cannot be used by managers (`Only ADMIN can create branches through onboarding rules`)
- role aliases accepted: `SALE`, `SALESPERSON`, `SALESPERSONS` -> `SALES`

### Role-Specific Rules

For `role=SALES`:

- `displayName` is required
- `branchId` is required unless auto-resolved from manager scope

For `role=MANAGER`:

- only branch admins can create manager onboarding rules
- manager cannot create `STANDALONE` manager onboarding rules
- `managerType=BRANCH_MANAGER` or `managerType=BRANCH_ADMIN` requires `branchId` unless auto-resolved
- `setAsPrimaryManager=true` is valid only with `managerType=BRANCH_ADMIN`
- creating `BRANCH_ADMIN` manager rules requires actor to be branch admin of the target branch

### Branch Auto-Resolution (Manager Route)

When `branchId` is omitted for `role=MANAGER` or `role=SALES`:

- if actor has a primary branch membership, that branch is used
- else if actor is primary manager of exactly one managed branch, that branch is used
- else if actor manages exactly one branch, that branch is used
- else request fails with `branchId is required when manager is assigned to multiple branches`

### Permissions Input Shapes

`permissions` can be:

- top-level role object
- scoped object (`permissions.manager` for MANAGER, `permissions.sales` for SALES)

MANAGER permission shape:

```json
{
  "managerType": "BRANCH_MANAGER | BRANCH_ADMIN | STANDALONE",
  "visibilityRole": "ADMIN | MANAGER | SALES",
  "capabilities": {
    "canCreateStaffRules": true,
    "canApproveRequests": true,
    "canRequestProductsFromAdmin": true,
    "canRequestManagerRestrictions": false,
    "canRequestManagerBans": false,
    "canRestrictSubordinates": false,
    "canBanSubordinates": false,
    "canLimitSubordinatePermissions": false
  }
}
```

SALES permission shape (optional onboarding commission):

```json
{
  "commission": {
    "rate": 10,
    "priority": 100,
    "note": "optional"
  }
}
```

Commission aliases also accepted for SALES: `commissionRate`, `commissionPriority`, `commissionNote`.

Commission validation:

- `commission.rate` is required when any commission field is provided
- `commission.rate` must be `0..100`
- `commission.priority` must be integer `0..1000`

### Example Create Requests

Create SALES (branch auto-resolved):

```json
{
  "role": "SALES",
  "email": "sales.a@company.com",
  "phone": "+66812345678",
  "displayName": "Sales A",
  "permissions": {
    "commission": {
      "rate": 12.5,
      "priority": 90,
      "note": "Launch campaign"
    }
  },
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

Create BRANCH_MANAGER with explicit branch:

```json
{
  "role": "MANAGER",
  "email": "manager.a@company.com",
  "phone": "+66811112222",
  "displayName": "Branch Manager A",
  "branchId": "11111111-2222-3333-4444-555555555555",
  "permissions": {
    "managerType": "BRANCH_MANAGER"
  }
}
```

### Create Success Response (201)

Response is a single `StaffOnboardingRule` object:

```json
{
  "id": "rule-uuid",
  "role": "MANAGER",
  "permissions": {
    "version": 1,
    "role": "MANAGER",
    "managerType": "BRANCH_MANAGER",
    "visibilityRole": "MANAGER",
    "capabilities": {
      "canCreateStaffRules": true,
      "canApproveRequests": true,
      "canRequestProductsFromAdmin": true,
      "canRequestManagerRestrictions": false,
      "canRequestManagerBans": false,
      "canRestrictSubordinates": false,
      "canBanSubordinates": false,
      "canLimitSubordinatePermissions": false
    }
  },
  "email": "manager.a@company.com",
  "emailNormalized": "manager.a@company.com",
  "phone": "+66811112222",
  "phoneNormalized": "+66811112222",
  "displayName": "Branch Manager A",
  "lineId": null,
  "note": null,
  "branchId": "11111111-2222-3333-4444-555555555555",
  "setAsPrimaryManager": false,
  "expiresAt": null,
  "claimedAt": null,
  "revokedAt": null,
  "createdAt": "2026-02-27T12:34:56.000Z",
  "updatedAt": "2026-02-27T12:34:56.000Z",
  "createdByUserId": "actor-user-uuid",
  "claimedByUserId": null,
  "revokedByUserId": null,
  "branch": {
    "id": "11111111-2222-3333-4444-555555555555",
    "code": "BKK-001",
    "name": "Bangkok Central",
    "status": "ACTIVE"
  }
}
```

### Common Create Errors

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 BRANCH_NOT_FOUND`
- `400 BRANCH_NOT_ACTIVE`
- `409 STAFF_RULE_CONFLICT`
- `409 STAFF_RULE_EMAIL_ALREADY_IN_USE`
- `403 CONTACT_BLOCKED`

## 3) List Rules

### Route

- `GET /api/v1/manager/staff-onboarding/rules`

### Query Params

- `status` optional: `PENDING | EXPIRED | CLAIMED | REVOKED`
- `limit` optional: `1..200` (default `50`)

Example:

- `/api/v1/manager/staff-onboarding/rules?status=PENDING&limit=50`

Manager list scope:

- only returns `MANAGER` and `SALES` rules
- includes rules created by actor
- includes rules in actor managed branches

### List Success Response (200)

```json
[
  {
    "id": "rule-uuid",
    "role": "SALES",
    "permissions": {
      "version": 1,
      "role": "SALES",
      "visibilityRole": "SALES",
      "capabilities": {},
      "commission": {
        "rate": 10,
        "priority": 100,
        "note": "base"
      }
    },
    "email": "sales.a@company.com",
    "emailNormalized": "sales.a@company.com",
    "phone": "+66812345678",
    "phoneNormalized": "+66812345678",
    "displayName": "Sales A",
    "lineId": null,
    "note": null,
    "branchId": "11111111-2222-3333-4444-555555555555",
    "setAsPrimaryManager": false,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "claimedAt": null,
    "revokedAt": null,
    "createdAt": "2026-02-27T12:34:56.000Z",
    "updatedAt": "2026-02-27T12:34:56.000Z",
    "createdByUserId": "actor-user-uuid",
    "claimedByUserId": null,
    "revokedByUserId": null,
    "branch": {
      "id": "11111111-2222-3333-4444-555555555555",
      "code": "BKK-001",
      "name": "Bangkok Central",
      "status": "ACTIVE"
    },
    "createdByUser": {
      "id": "actor-user-uuid",
      "email": "manager@company.com",
      "role": "MANAGER"
    },
    "claimedByUser": null,
    "revokedByUser": null,
    "status": "PENDING"
  }
]
```

Status is computed by backend:

- `REVOKED` when `revokedAt` is not null
- `CLAIMED` when `claimedAt` is not null
- `EXPIRED` when `expiresAt <= now` and not claimed/revoked
- otherwise `PENDING`

### Common List Errors

- `400 VALIDATION_ERROR` (invalid `status`)
- `403 FORBIDDEN`

## 4) Revoke Rule

### Route

- `PATCH /api/v1/manager/staff-onboarding/rules/:ruleId/revoke`

### Path Param

- `ruleId` required UUID

Manager revoke scope rules:

- cannot revoke `ADMIN` onboarding rules
- can revoke rules in managed branches
- can revoke own created rules
- for target `MANAGER` rule with `managerType=BRANCH_ADMIN` (not created by actor), actor must be branch admin for that branch
- claimed rules cannot be revoked
- already revoked rules return current record (idempotent response)

### Revoke Success Response (200)

```json
{
  "id": "rule-uuid",
  "role": "SALES",
  "permissions": {
    "version": 1,
    "role": "SALES",
    "visibilityRole": "SALES",
    "capabilities": {},
    "commission": null
  },
  "email": "sales.a@company.com",
  "emailNormalized": "sales.a@company.com",
  "phone": "+66812345678",
  "phoneNormalized": "+66812345678",
  "displayName": "Sales A",
  "lineId": null,
  "note": null,
  "branchId": "11111111-2222-3333-4444-555555555555",
  "setAsPrimaryManager": false,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "claimedAt": null,
  "revokedAt": "2026-02-27T13:45:00.000Z",
  "createdAt": "2026-02-27T12:34:56.000Z",
  "updatedAt": "2026-02-27T13:45:00.000Z",
  "createdByUserId": "actor-user-uuid",
  "claimedByUserId": null,
  "revokedByUserId": "actor-user-uuid",
  "branch": {
    "id": "11111111-2222-3333-4444-555555555555",
    "code": "BKK-001",
    "name": "Bangkok Central",
    "status": "ACTIVE"
  }
}
```

### Common Revoke Errors

- `400 VALIDATION_ERROR` (`ruleId` missing/invalid)
- `403 FORBIDDEN`
- `404 STAFF_RULE_NOT_FOUND`
- `409 STAFF_RULE_ALREADY_CLAIMED`

## 5) Quick Test Sequence (Manager)

1. Create SALES rule via manager route.
2. List rules with `status=PENDING` and verify new rule appears.
3. Revoke that rule using returned `id`.
4. List rules with `status=REVOKED` and verify `revokedAt` and `revokedByUserId` are set.
