# Staff Onboarding Rule API Usage (Updated)

Last updated: 2026-02-26

## Base Contract

- Base API prefix: `/api/v1`
- Auth header (protected routes): `Authorization: Bearer <supabase_access_token>`
- Error format:

```json
{
  "message": "string",
  "code": "STRING",
  "stack": "string (non-production only)"
}
```

## Routes

- `POST /api/v1/admin/staff-onboarding/rules`
- `GET /api/v1/admin/staff-onboarding/rules`
- `PATCH /api/v1/admin/staff-onboarding/rules/:ruleId/revoke`
- `POST /api/v1/manager/staff-onboarding/rules`
- `GET /api/v1/manager/staff-onboarding/rules`
- `PATCH /api/v1/manager/staff-onboarding/rules/:ruleId/revoke`

Admin and manager endpoints share payload/response shape. Scope checks differ.

## 1) Create Rule

### Routes

- `POST /api/v1/admin/staff-onboarding/rules`
- `POST /api/v1/manager/staff-onboarding/rules`

### Request Body

```json
{
  "role": "ADMIN | MANAGER | SALES",
  "email": "staff@company.com",
  "phone": "+66812345678",
  "displayName": "optional for ADMIN/MANAGER, required for SALES",
  "lineId": "optional",
  "note": "optional",
  "branchId": "uuid or null",
  "branchName": "string or null",
  "setAsPrimaryManager": false,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "permissions": {}
}
```

Also accepted:

- `permission` (singular) instead of `permissions`
- but never both `permissions` and `permission` together

### Accepted Role Aliases

- `SALE` -> `SALES`
- `SALESPERSON` -> `SALES`
- `SALESPERSONS` -> `SALES`

### Permission Payload Shapes

You can send either:

- top-level object (for target role)
- scoped object (`permissions.admin` or `permissions.manager`)

### ADMIN Permission Shape

```json
{
  "visibilityRole": "ADMIN | MANAGER | SALES",
  "capabilities": {
    "canReadProducts": true,
    "canCreateProducts": true,
    "canEditProducts": true,
    "canHandleRequests": true,
    "canDeleteLogs": true,
    "canManageProductVisibility": true,
    "canManageStaffRules": true,
    "canRestrictUsers": true,
    "canBanUsers": true
  }
}
```

### MANAGER Permission Shape

```json
{
  "managerType": "STANDALONE | BRANCH_MANAGER | BRANCH_ADMIN",
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

### SALES Permission Shape

- SALES permissions are not configurable.
- For SALES onboarding rules, omit `permissions`.

### Validation Rules

- `expiresAt` must be a valid future datetime.
- `branchId` must be UUID if provided.
- Never send both `branchId` and `branchName`.
- `role=ADMIN`: `branchId` and `branchName` are not allowed.
- `role=SALES`: `branchId` is required and `displayName` is required.
- `role=MANAGER` with `managerType=STANDALONE`: `branchId` must be empty.
- `role=MANAGER` with `managerType=BRANCH_MANAGER`: `branchId` is required.
- `role=MANAGER` with `managerType=BRANCH_ADMIN`: use existing `branchId`, or `branchName` on admin route.
- `setAsPrimaryManager` is only valid with `managerType=BRANCH_ADMIN`.

Manager capability coherence:

- `canRequestManagerBans` requires `canRequestManagerRestrictions`.
- `canBanSubordinates` requires `canRestrictSubordinates`.
- `canLimitSubordinatePermissions` requires `canCreateStaffRules`.
- STANDALONE cannot hold branch-sensitive powers: `canCreateStaffRules`, `canApproveRequests`, `canRestrictSubordinates`, `canBanSubordinates`, `canLimitSubordinatePermissions`.
- STANDALONE must keep `canRequestProductsFromAdmin=true`, `canRequestManagerRestrictions=true`, `canRequestManagerBans=true`.
- Non-standalone managers cannot request manager restriction/ban actions.
- Only `BRANCH_ADMIN` can use subordinate restriction/ban/limit powers.
- `BRANCH_ADMIN` must keep `canCreateStaffRules=true`, `canApproveRequests=true`, `canRequestProductsFromAdmin=true`.

### Branch Creation via `branchName` (New)

Supported only when all are true:

- route is admin create route
- `role=MANAGER`
- `managerType=BRANCH_ADMIN`
- `branchId` is empty
- `branchName` is provided

Behavior:

- backend creates a new ACTIVE branch automatically
- branch code is auto-generated and unique
- created rule is saved with the new `branchId`

### Manager Actor Scope Guards

When creator is `MANAGER`:

- cannot create `ADMIN` onboarding rules
- must have branch-scoped manager permissions (`canCreateStaffRules=true`)
- cannot create standalone manager onboarding rules
- can only target managed branches
- only branch admins can create `BRANCH_ADMIN` rules in their own branch
- cannot grant manager capabilities they do not currently hold

### Success Response (201)

```json
{
  "id": "uuid",
  "role": "ADMIN|MANAGER|SALES",
  "permissions": {},
  "email": "staff@company.com",
  "emailNormalized": "staff@company.com",
  "phone": "+66812345678",
  "phoneNormalized": "+66812345678",
  "displayName": "string|null",
  "lineId": "string|null",
  "note": "string|null",
  "branchId": "uuid|null",
  "setAsPrimaryManager": false,
  "expiresAt": "datetime|null",
  "claimedAt": null,
  "revokedAt": null,
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "createdByUserId": "uuid",
  "claimedByUserId": null,
  "revokedByUserId": null,
  "branch": {
    "id": "uuid",
    "code": "string",
    "name": "string",
    "status": "ACTIVE|INACTIVE"
  }
}
```

### Create Examples

Admin creates BRANCH_ADMIN + new branch in one call:

```json
{
  "role": "MANAGER",
  "email": "branch.admin@company.com",
  "phone": "+66812345678",
  "displayName": "Branch Admin A",
  "branchName": "Bangkok Central",
  "permissions": {
    "managerType": "BRANCH_ADMIN"
  }
}
```

Admin creates BRANCH_MANAGER under existing branch:

```json
{
  "role": "MANAGER",
  "email": "manager@company.com",
  "phone": "+66811112222",
  "displayName": "Branch Manager A",
  "branchId": "11111111-2222-3333-4444-555555555555",
  "permissions": {
    "managerType": "BRANCH_MANAGER"
  }
}
```

Create SALES under existing branch:

```json
{
  "role": "SALES",
  "email": "sales@company.com",
  "phone": "+66899998888",
  "displayName": "Sales A",
  "branchId": "11111111-2222-3333-4444-555555555555"
}
```

## 2) List Rules

### Routes

- `GET /api/v1/admin/staff-onboarding/rules`
- `GET /api/v1/manager/staff-onboarding/rules`

### Query Params

- `status` optional: `PENDING | EXPIRED | CLAIMED | REVOKED`
- `limit` optional: integer `1..200` (default `50`)

Example:

- `/api/v1/admin/staff-onboarding/rules?status=PENDING&limit=50`

### Success Response (200)

```json
[
  {
    "id": "uuid",
    "role": "MANAGER",
    "permissions": {},
    "email": "m@x.com",
    "emailNormalized": "m@x.com",
    "phone": "+66800000000",
    "phoneNormalized": "+66800000000",
    "displayName": "Name",
    "lineId": null,
    "note": null,
    "branchId": "uuid",
    "setAsPrimaryManager": false,
    "expiresAt": null,
    "claimedAt": null,
    "revokedAt": null,
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "createdByUserId": "uuid",
    "claimedByUserId": null,
    "revokedByUserId": null,
    "branch": {
      "id": "uuid",
      "code": "BRANCH-CODE",
      "name": "Branch Name",
      "status": "ACTIVE"
    },
    "createdByUser": {
      "id": "uuid",
      "email": "admin@x.com",
      "role": "ADMIN"
    },
    "claimedByUser": null,
    "revokedByUser": null,
    "status": "PENDING"
  }
]
```

## 3) Revoke Rule

### Routes

- `PATCH /api/v1/admin/staff-onboarding/rules/:ruleId/revoke`
- `PATCH /api/v1/manager/staff-onboarding/rules/:ruleId/revoke`

### Path Param

- `ruleId` required UUID

### Success Response (200)

- returns single onboarding rule object (same core shape as create response)

### Notes

- claimed rule cannot be revoked (`409`)
- revoking an already revoked rule returns the existing revoked record

## Common Error Codes

- `VALIDATION_ERROR`
- `FORBIDDEN`
- `ADMIN_PERMISSION_DENIED`
- `ADMIN_ACTION_RESTRICTED`
- `STAFF_RULE_CONFLICT`
- `STAFF_RULE_EMAIL_ALREADY_IN_USE`
- `BRANCH_NOT_FOUND`
- `BRANCH_NOT_ACTIVE`
- `BRANCH_CODE_GENERATION_FAILED`
- `CONTACT_BLOCKED`
- `STAFF_RULE_NOT_FOUND`
- `STAFF_RULE_ALREADY_CLAIMED`
- `UNAUTHORIZED`
