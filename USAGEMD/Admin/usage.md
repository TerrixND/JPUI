# Admin And Main Admin Frontend Usage

This document covers the backend routes that the Next.js admin frontend should use for:

- main admin bootstrap and account sync
- admin dashboard session bootstrapping
- admin user management, permissions, restriction, ban, termination, and resolve flows
- admin approval workflows
- product creation, edit, and quick visibility flows
- branch network and branch detail pages
- logs, analytics, inventory requests, and staff onboarding rules
- manager-to-admin quick visibility request flow

Base API prefix:

- `http://<api-host>/api/v1`

Authentication:

- Protected routes require the same authenticated session used by the app.
- Send the Supabase access token as `Authorization: Bearer <token>` if your frontend is using token forwarding.
- If your frontend is using cookies, keep `credentials: "include"` enabled.

Common response pattern:

- Success returns JSON.
- Errors return:

```json
{
  "message": "Human readable message",
  "code": "MACHINE_CODE",
  "details": {}
}
```

Important approval pattern:

- Some routes return `200` or `201` when applied immediately.
- The same routes return `202` with an `approvalRequest` object when main admin approval is required.
- The frontend should treat `202` as a successful submission state, not as a failure.

Important account access pattern:

- `GET /api/v1/user/me` now includes `accountAccess`.
- Restricted users can still authenticate, but `accountAccess.canAccessRoleRoutes` will be `false`.
- Protected admin or manager routes can return `403` with `code` like `ACCOUNT_RESTRICTED`, `ACCOUNT_BANNED`, or `ACCOUNT_TERMINATED`, and `details` contains remaining time and block scope.

Recommended frontend fetch wrapper:

```ts
export async function apiFetch<T>(
        path: string,
        init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.message || "Request failed");
    (error as any).status = res.status;
    (error as any).code = data?.code;
    (error as any).details = data?.details;
    throw error;
  }

  return data as T;
}
```

## Session Bootstrap Routes

### `POST /api/v1/auth/precheck-signup`

- Use before signup or setup flow.
- Auth: public.
- Purpose:
  - detect whether the email/phone is eligible for customer signup
  - detect whether the email/phone matches a staff onboarding rule
  - validate main-admin bootstrap eligibility
  - reject blocked, banned, or terminated email/phone combinations
- Body:

```json
{
  "email": "user@example.com",
  "phone": "+15551234567",
  "flow": "CUSTOMER | STAFF | BOOTSTRAP_ADMIN",
  "bootstrapSecret": "only for bootstrap flow"
}
```

- Success:
  - `200`
  - response includes `eligible`, `flow`, `onboardingType`, `role`
  - for staff flow it also returns `permissions`
- Frontend use:
  - call this before showing the final setup form
  - if `code === "CONTACT_BLOCKED"`, show the blocked/banned page and do not continue

### `POST /api/v1/auth/bootstrap-admin`

- Use only once to create the first main admin.
- Auth: required.
- Body:

```json
{
  "displayName": "Main Admin",
  "phone": "+15551234567",
  "lineId": "line-id",
  "note": "Bootstrap super admin"
}
```

- Header:
  - authenticated user must already exist in Supabase
  - bootstrap secret is validated earlier through precheck flow
- Success:
  - `201` on first creation
  - returns created admin user record
- Frontend use:
  - call only from the protected bootstrap setup page
  - once this succeeds, redirect to admin dashboard and refresh `/api/v1/user/me`

### `POST /api/v1/auth/setup-user`

- Use after a user authenticates with Supabase and you need the app database user record.
- Auth: required.
- Purpose:
  - creates or syncs staff/customer user records
  - applies onboarding rule permissions
  - rejects blocked contacts
- Body:
  - for customer flow: customer profile fields
  - for staff flow: profile fields including required phone
- Success:
  - `200` or `201`
  - returns the app user record

### `GET /api/v1/user/me`

- Use on every app boot, dashboard layout mount, middleware refresh, and role gate refresh.
- Auth: required.
- Success:

```json
{
  "id": "uuid",
  "supabaseUserId": "supabase-id",
  "email": "user@example.com",
  "role": "ADMIN",
  "status": "ACTIVE",
  "isMainAdmin": true,
  "isSetup": true,
  "accountAccess": {
    "code": "ACCOUNT_RESTRICTED",
    "blockedScope": "ROLE_ROUTES",
    "canAuthenticate": true,
    "canAccessRoleRoutes": false,
    "remainingMs": 3600000
  }
}
```

- Frontend use:
  - if `accountAccess?.canAccessRoleRoutes === false`, block admin pages and show restriction countdown UI
  - if role is not `ADMIN`, do not render admin dashboard shell

## Media Upload Routes

Use these before product creation or edit when you need media ids.

### `POST /api/v1/media/presign`

- Auth: required.
- Purpose: request upload instructions for R2 or object storage.
- Precise backend rules:
  - `productId` and `consignmentAgreementId` are mutually exclusive
  - if either `productId` or `consignmentAgreementId` is provided, caller must be an admin
- Body:

```json
{
  "fileName": "ring.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 524288,
  "productId": "optional-product-uuid",
  "consignmentAgreementId": "optional-consignment-agreement-uuid"
}
```

- Success:
  - returns `uploadUrl`, `key`, and the accepted `productId` or `consignmentAgreementId`
- Frontend use:
  - upload file directly to storage first
  - then create the media record with the returned object `key`

### `POST /api/v1/media`

- Auth: required.
- Purpose: create the saved media record and get a reusable `mediaId`.
- Precise backend rules:
  - only admin can attach media directly to `productId` or `consignmentAgreementId`
  - `slot: "CONSIGNMENT_CONTRACT"` requires `consignmentAgreementId` and a PDF mime type
  - if `consignmentAgreementId` is provided and `slot` is omitted, backend defaults slot to `CONSIGNMENT_CONTRACT`
- Body:

```json
{
  "key": "media/uploads/....",
  "mimeType": "image/jpeg",
  "sizeBytes": 524288,
  "productId": "optional-product-uuid",
  "consignmentAgreementId": "optional-consignment-agreement-uuid",
  "slot": "PUBLIC_THUMBNAIL | PUBLIC_FEATURE_VIDEO | PUBLIC_GALLERY | PUBLIC_CERTIFICATE | ROLE_REFERENCE | CONSIGNMENT_CONTRACT",
  "displayOrder": 0,
  "audience": "PUBLIC | PRIVATE | ROLE_BASED | TARGETED | ADMIN_ONLY",
  "visibilitySections": ["PRODUCT_PAGE"],
  "allowedRoles": ["ADMIN"],
  "minCustomerTier": "REGULAR | VIP | ULTRA_VIP",
  "targetUserIds": ["optional-customer-user-id"]
}
```

- Success:
  - `201`
  - returns media record
- Frontend use:
  - for product create/edit flows, prefer attaching uploaded media through the product payload documented below
  - use explicit media visibility fields here only when the admin UI is creating or editing standalone media records first

### `GET /api/v1/media/:mediaId/url`

- Auth: required.
- Purpose: get a signed view URL for authenticated user flow.
- Access note:
  - non-admin staff cannot use this route to open media attached to `PRIVATE` products
  - admin can always use the admin-scoped media URL route for product edit/review flows

### `DELETE /api/v1/media/:mediaId`

- Auth: required.
- Purpose: delete a media record from authenticated user scope.

### `GET /api/v1/admin/media/:mediaId/url`

- Auth: admin.
- Use inside admin edit pages for any media that admin must always be able to open.

### `DELETE /api/v1/admin/media/:mediaId`

- Auth: admin.
- Permission:
  - requires product edit access
- Use when removing product media from admin edit UI.

## Product Management Routes

### `POST /api/v1/admin/products`

- Auth: admin.
- Permission:
  - `canCreateProducts`
  - create implies edit in permission profile
- Approval behavior:
  - returns `201` if direct apply is allowed
  - returns `202` with `approvalRequest` if main admin approval is required
- Main body shape for frontend:

```json
{
  "sku": "JP-0001",
  "name": "Emerald Ring",
  "color": "Green",
  "origin": "Myanmar",
  "description": "Detailed description",
  "buyPrice": 1000,
  "saleMinPrice": 1200,
  "saleMaxPrice": 1800,
  "weight": 3.5,
  "weightUnit": "GRAM",
  "length": 10,
  "depth": 5,
  "height": 8,
  "importDate": "2026-02-28T10:00:00.000Z",
  "importId": "IMP-001",
  "fromCompanyId": "COMP-01",
  "visibility": "PRIVATE | STAFF | PUBLIC | TOP_SHELF | USER_TIER | TARGETED_USER",
  "tier": "STANDARD | VIP | ULTRA_RARE",
  "status": "AVAILABLE | PENDING | BUSY | SOLD",
  "minCustomerTier": "REGULAR | VIP | ULTRA_VIP",
  "targetUserIds": ["customer-user-id"],
  "visibilityNote": "Optional note",
  "sourceType": "OWNED | CONSIGNED",
  "consignmentRate": 15,
  "consignmentAgreementId": "consignment-agreement-uuid",
  "publicMedia": {
    "thumbnailMediaId": "media-id",
    "featureVideoMediaId": "media-id",
    "galleryMediaIds": ["media-id-1", "media-id-2"],
    "certificateMediaId": "media-id-3"
  },
  "roleBasedMedia": [
    {
      "mediaId": "media-id-4",
      "allowedRoles": ["ADMIN", "MANAGER"],
      "displayOrder": 0
    }
  ],
  "consignmentContractMediaId": "pdf-media-id",
  "commissionAllocations": [
    {
      "targetType": "USER | BRANCH",
      "beneficiaryUserId": "uuid",
      "beneficiaryBranchId": "uuid",
      "rate": 7.5,
      "note": "Optional note"
    }
  ]
}
```

- Frontend rules:
  - if `sourceType === "CONSIGNED"`, hide `buyPrice` and send `consignmentRate`
  - if `visibility === "USER_TIER"`, send `minCustomerTier`
  - if `visibility === "TARGETED_USER"`, send `targetUserIds`
  - if `visibility === "PRIVATE"`, `roleBasedMedia.allowedRoles` can only contain `ADMIN`
  - `consignmentContractMediaId` should only be sent for consigned products
  - backend still accepts legacy aliases such as `mediaIds`, `publicReadyMedia`, `thumbnailImageId`, `featureVideoId`, `galleryImageIds`, `roleMedia`, and `staffMedia`

### `GET /api/v1/admin/products`

- Auth: admin.
- Permission:
  - `canReadProducts`
- Purpose: product list page.
- Use for:
  - product table
  - admin quick visibility dropdown source data
  - inspection page while reviewing requests
- Frontend use:
  - call on page load and after create/edit/visibility changes

### `GET /api/v1/admin/products/:productId`

- Auth: admin.
- Permission:
  - `canReadProducts`
- Purpose: product detail or edit page.

### `PATCH /api/v1/admin/products/:productId/quick-visibility`

- Auth: admin.
- Permission:
  - `canManageProductVisibility`
  - also blocked by admin-action-only restriction for `PRODUCT_VISIBILITY_MANAGE`
- Approval behavior:
  - `200` if direct apply is allowed
  - `202` with `approvalRequest` if approval is required
- Use only for the quick dropdown flow, not for full edit.
- Body:

```json
{
  "visibility": "PRIVATE | STAFF | PUBLIC | TOP_SHELF | USER_TIER | TARGETED_USER",
  "minCustomerTier": "REGULAR | VIP | ULTRA_VIP",
  "targetUserIds": ["customer-user-id"],
  "visibilityNote": "Optional note",
  "reason": "Optional approval reason"
}
```

- Quick flow rules enforced by backend:
  - current `PRIVATE` or `STAFF` with no customer tier can quick-switch only among `PRIVATE`, `STAFF`, `PUBLIC`, `TOP_SHELF`
  - current `PRIVATE` or `STAFF` with customer tier can quick-switch only to `USER_TIER`
  - current `PUBLIC` or `TOP_SHELF` can quick-switch only between `PUBLIC` and `TOP_SHELF`
  - current `USER_TIER` can only quick-update `USER_TIER`
  - current `TARGETED_USER` can only quick-update `TARGETED_USER`
- Frontend use:
  - if backend returns `QUICK_VISIBILITY_NOT_ALLOWED`, route user to full edit page instead

### `PATCH /api/v1/admin/products/:productId`

- Auth: admin.
- Permission:
  - `canEditProducts`
  - if the patch changes visibility fields, backend also requires `canManageProductVisibility`
- Approval behavior:
  - normal edit can return `200` or `202`
  - visibility-related edit uses product visibility approval policy
- Use for full edit page.
- Body:
  - send only changed fields
  - backend supports the same field family as product create
  - media updates use the same `publicMedia`, `roleBasedMedia`, and `consignmentContractMediaId` structure
  - if you send any of those media groups, backend treats that group as the replacement set for that section

### `PATCH /api/v1/admin/products/:productId/status`

- Auth: admin.
- Permission:
  - product edit access
- Body:

```json
{
  "status": "AVAILABLE | PENDING | BUSY | SOLD",
  "note": "Optional note"
}
```

### `DELETE /api/v1/admin/products/:productId`

- Auth: admin.
- Permission:
  - product delete access
- Frontend use:
  - use only from destructive confirmation modal

## User Management Routes

### `GET /api/v1/admin/users`

- Auth: admin.
- Purpose:
  - users table
  - main admin user management page
  - admin compact user info list
- Frontend use:
  - this is the entry point for user management

### `GET /api/v1/admin/users/:userId`

- Auth: admin.
- Purpose:
  - user detail page data
  - main admin settings page data
- Behavior:
  - main admin can use the full settings experience
  - regular admin can still view user info, but not main-admin-only settings features
- Frontend use:
  - show identity block, role, status, contact fields, and permission summary

### `GET /api/v1/admin/users/:userId/audit-logs`

- Auth: admin, main admin only.
- Purpose:
  - separate audit-log tab/page from user detail
- Query:
  - `scope=ALL|ACTOR|ENTITY`
  - `page`
  - `limit`
  - `from`
  - `to`
- Frontend use:
  - default to `scope=ALL`
  - use `ACTOR` to see actions performed by the user
  - use `ENTITY` to see actions done to the user record

### `GET /api/v1/admin/users/:userId/approval-requests`

- Auth: admin, main admin only.
- Purpose:
  - separate request-history tab/page from user detail
- Query:
  - `status=PENDING|APPROVED|REJECTED|CANCELLED`
  - `relation=ALL|SUBMITTED|TARGETED`
  - `page`
  - `limit`
- Frontend use:
  - `SUBMITTED` shows requests made by that user
  - `TARGETED` shows requests aimed at that user
  - `ALL` is the safest default

### `PATCH /api/v1/admin/users/:userId/permissions`

- Auth: admin.
- Main use:
  - save permission form from main admin user detail page
  - update onboarding-derived permission config later
- Access:
  - main admin only
- Body:
  - send the full permission config object used by the frontend form
  - backend accepts either the full object at the root or nested under `permissions`
- Example:

```json
{
  "permissions": {
    "visibilityRole": "ADMIN",
    "capabilities": {
      "canReadProducts": true,
      "canCreateProducts": true,
      "canEditProducts": true,
      "canHandleRequests": true,
      "canDeleteLogs": false,
      "canManageProductVisibility": true,
      "canManageStaffRules": false,
      "canRestrictUsers": true,
      "canBanUsers": false
    }
  }
}
```
- Validation note:
  - `canCreateProducts` requires `canEditProducts`
  - `canBanUsers` requires `canRestrictUsers`
- Frontend use:
  - after save, refresh user detail and user list

### `POST /api/v1/admin/users/:userId/restrictions`

- Auth: admin.
- Permission:
  - `canRestrictUsers`
- Use for:
  - timed restriction
  - admin-capability-only restriction
- Precise backend rules:
  - new restrictions must be between `1 hour` and `24 hours`
  - `reason` is required when creating a new restriction
  - `actionType: "ADMIN_CAPABILITIES"` automatically maps to `restrictionMode: "ADMIN_ACTIONS"`
  - capability restrictions are valid only for target users with role `ADMIN`
  - backend also accepts `durationHours` or `durationDays`, but the final computed window must still stay within `1 hour` to `24 hours`
- Body examples:

Full account restriction:

```json
{
  "reason": "Investigation",
  "note": "Temporary dashboard block",
  "startsAt": "2026-02-28T10:00:00.000Z",
  "endsAt": "2026-02-28T20:00:00.000Z",
  "restrictionMode": "ACCOUNT"
}
```

Admin capability restriction using capability keys:

```json
{
  "actionType": "ADMIN_CAPABILITIES",
  "reason": "Temporary limited access",
  "note": "Hold create and approval actions during review",
  "startsAt": "2026-02-28T10:00:00.000Z",
  "endsAt": "2026-02-28T18:00:00.000Z",
  "capabilityKeys": [
    "canCreateProducts",
    "canHandleRequests",
    "canRestrictUsers"
  ]
}
```

Admin capability restriction using explicit action blocks:

```json
{
  "reason": "Temporary limited access",
  "startsAt": "2026-02-28T10:00:00.000Z",
  "endsAt": "2026-02-28T18:00:00.000Z",
  "restrictionMode": "ADMIN_ACTIONS",
  "adminActionBlocks": [
    "PRODUCT_CREATE",
    "APPROVAL_REVIEW",
    "USER_RESTRICT"
  ]
}
```

- Frontend rules:
  - for full account restriction, use `restrictionMode: "ACCOUNT"`
  - for capability-only restriction, prefer `actionType: "ADMIN_CAPABILITIES"` with `capabilityKeys`
  - supported capability keys:
    - `canReadProducts`
    - `canCreateProducts`
    - `canEditProducts`
    - `canHandleRequests`
    - `canDeleteLogs`
    - `canManageProductVisibility`
    - `canManageStaffRules`
    - `canRestrictUsers`
    - `canBanUsers`
  - backend also accepts `capabilities` as an object and converts truthy keys into restricted capability blocks

### `POST /api/v1/admin/users/:userId/ban`

- Auth: admin.
- Permission:
  - `canBanUsers`
- Approval behavior:
  - can require main admin approval
  - auto approve is not allowed for ban policy
- Body example:

```json
{
  "reason": "Fraud risk",
  "note": "Temporary ban",
  "startsAt": "2026-02-28T10:00:00.000Z",
  "endsAt": "2026-02-28T22:00:00.000Z"
}
```

- Frontend use:
  - backend enforces a `1 hour` to `24 hours` window
  - backend also accepts `durationHours` or `durationDays` instead of explicit `endsAt`, but explicit timestamps are safer for admin UI
  - use this for temporary ban
  - for permanent termination, use the status route with `TERMINATED`

### `PATCH /api/v1/admin/users/:userId/status`

- Auth: admin.
- Permission:
  - route still carries the user-ban access block, but backend only allows direct execution by main admin
- Use for:
  - direct restore to `ACTIVE`
  - direct `SUSPENDED`
  - direct permanent `TERMINATED`
- Body:

```json
{
  "status": "ACTIVE | SUSPENDED | TERMINATED",
  "reason": "Required for TERMINATED",
  "note": "Optional note"
}
```

- Frontend use:
  - regular admins should not use this route for direct state changes
  - prefer restriction/ban routes for timed actions
  - `TERMINATED` is implemented as a permanent active ban control with termination metadata, so it can still be resolved later by main admin if needed

### `PATCH /api/v1/admin/users/:userId/admin-actions/resolve`

- Auth: admin, main admin only.
- Purpose:
  - resolve active restriction
  - resolve active ban
  - lift termination by resolving the permanent termination control
- Body:

```json
{
  "actionType": "RESTRICTION | BAN | TERMINATION",
  "controlId": "optional-active-control-id",
  "note": "Resolved after review"
}
```

- Frontend use:
  - show this button only for main admin
  - if the user detail response shows active controls or non-active status, enable resolve action

## Approval Routes

### `GET /api/v1/admin/approval-requests`

- Auth: admin.
- Permission:
  - `canHandleRequests` for non-main-admin admins
- Purpose:
  - approval center page
  - request drawer counts
- Query:
  - `page`
  - `limit`
  - `status=PENDING|APPROVED|REJECTED|CANCELLED`
  - `actionType=PRODUCT_CREATE|PRODUCT_UPDATE|PRODUCT_VISIBILITY_UPDATE|USER_STATUS_CHANGE|USER_RESTRICTION_UPSERT|USER_BAN|LOG_DELETE|STAFF_RULE_CREATE|STAFF_RULE_REVOKE`
  - `targetUserId`
  - `requestedByUserId`
- Reviewer scope:
  - main admin can see all matching requests
  - regular admins only see manager-originated reviewable requests
- Frontend use:
  - poll or refresh after every approval decision

### `PATCH /api/v1/admin/approval-requests/:requestId/decision`

- Auth: admin.
- Permission:
  - handle requests
- Body:

```json
{
  "decision": "APPROVE | REJECT",
  "decisionNote": "Optional note",
  "enableAutoApproveForFuture": true
}
```

- Special behavior:
  - when approving product create/edit/visibility requests, you can include override fields in the same body
  - backend merges those override fields into the original request payload before applying
  - this supports the "inspect and adjust before approve" flow requested for main admin
  - backend also accepts `note` as an alias of `decisionNote`
  - backend also accepts `autoApproveFuture` or `doNotAskAgainForAction` as aliases of `enableAutoApproveForFuture`
- Frontend use:
  - for inspection page, send changed product fields together with `decision: "APPROVE"`
  - when `enableAutoApproveForFuture` is true:
    - admin targets can get saved auto-approve preference in user permissions
    - manager quick visibility requests get `autoApproveFuture` set on approved request history

## Customer, Sales, Inventory, And Logs

### `GET /api/v1/admin/customers`

- Use for customer admin table and targeted-user picker pages.

### `GET /api/v1/admin/sales`

- Use for sales reporting pages.

### `GET /api/v1/admin/inventory-requests`

- Use for full inventory request list.

### `GET /api/v1/admin/inventory-requests/pending`

- Use for dashboard pending queue badge.

### `GET /api/v1/admin/inventory-requests/successful-sales`

- Use for matching successful sales created through inventory requests.

### `PATCH /api/v1/admin/inventory-requests/:requestId/decision`

- Auth: admin.
- Permission:
  - inventory request decision
- Body:

```json
{
  "decision": "APPROVED | REJECTED | CANCELLED | FULFILLED",
  "note": "Optional note"
}
```

### `GET /api/v1/admin/audit-logs`

- Use for global audit log page.
- Query:
  - `page`
  - `limit`
  - `from`
  - `to`
  - `actorUserId`
  - `branchId`
  - `action`
  - `entityType`
  - `entityId`

### `DELETE /api/v1/admin/audit-logs`

- Auth: admin.
- Permission:
  - log delete
- Approval behavior:
  - can return `202`
- Body:

```json
{
  "reason": "Cleanup reason"
}
```

### `GET /api/v1/admin/internal-error-logs`

- Use for internal error monitoring page.

### `DELETE /api/v1/admin/internal-error-logs`

- Auth: admin.
- Permission:
  - log delete
- Approval behavior:
  - can return `202`

### `GET /api/v1/admin/log-backups`

- Use after log deletion to list backup files.
- Query:
  - `type=all|internal|audit|product|other`

### `GET /api/v1/admin/log-backups/:fileName`

- Use to download or preview backup content.

## Branch Network And Branch Detail Routes

### `GET /api/v1/admin/analytics/branches`

- Use for the Admin Branch Network Page.
- Query:
  - `page`
  - `status=ACTIVE|INACTIVE`
  - `includeInactiveBranches=true|false`
  - `rows=10|25|50`
- Response use:
  - filter section
  - analytics cards
  - branch table rows

### `GET /api/v1/admin/branches-with-managers`

- Use for branch selectors and quick manager lookup.

### `GET /api/v1/admin/branches/:branchId`

- Use for the dedicated branch page.
- Response includes:
  - `branch`
  - `analytics`
  - `users`
  - `recentAuditLogs`
- Frontend use:
  - render branch detail header
  - render branch analytics cards
  - render branch user table
  - link to full branch audit log page
  - active possession counts in analytics reflect only currently checked-out, not-yet-returned possessions

### `GET /api/v1/admin/branches/:branchId/audit-logs`

- Use for branch audit log page.
- Query:
  - `page`
  - `limit`
  - `from`
  - `to`
  - `action`
  - `entityType`

### `GET /api/v1/admin/branches/:branchId/members`

- Use for simple branch membership list.

### `GET /api/v1/admin/branches/:branchId/users`

- Use when you need full branch users with commission context.
- Response note:
  - each user entry can include `permissionConfiguredBy` with the actor and timestamp of the latest admin-permission configuration change for that user in this branch view

### `GET /api/v1/admin/branches/:branchId/possessions`

- Use for branch product possession table.

### `GET /api/v1/admin/branches/:branchId/performance`

- Use for branch sales/performance cards.

### `GET /api/v1/admin/branches/:branchId/commissions`

- Use for branch commission report.

### Branch detail route behavior

- `GET /api/v1/admin/branches/:branchId/members`
- `GET /api/v1/admin/branches/:branchId/users`
- `GET /api/v1/admin/branches/:branchId/possessions`
- `GET /api/v1/admin/branches/:branchId/performance`
- `GET /api/v1/admin/branches/:branchId/commissions`

- If the branch does not exist, backend now returns `404 BRANCH_NOT_FOUND` consistently for all of the routes above.

### `GET /api/v1/admin/salespersons/:salespersonUserId/performance`

- Use for salesperson drill-down page from branch detail or sales analytics.

### `GET /api/v1/admin/analytics/inventory-profit`

- Use for admin inventory profit analytics page.
- Query:
  - `includeSold=true|false`

### `GET /api/v1/admin/analytics/requests`

- Use for request analytics charts.

## Staff Onboarding Routes

### `POST /api/v1/admin/staff-onboarding/rules`

- Auth: admin.
- Permission:
  - manage staff rule
- Approval behavior:
  - can return `202`
- Use for:
  - creating admin onboarding rules
  - creating manager onboarding rules
  - creating sales onboarding rules
- Frontend body should include:
  - role
  - permissions payload
  - email
  - phone
  - displayName
  - lineId
  - branchId when needed
  - expiresAt
  - note

### `GET /api/v1/admin/staff-onboarding/rules`

- Use for staff rule management table.

### `PATCH /api/v1/admin/staff-onboarding/rules/:ruleId/revoke`

- Auth: admin.
- Permission:
  - manage staff rule
- Approval behavior:
  - can return `202`
- Body:

```json
{
  "reason": "Optional revoke reason"
}
```

## Manager To Admin Visibility Request Bridge

This is the manager-side route that feeds admin approval flow for product visibility.

### `PATCH /api/v1/manager/products/:productId/quick-visibility`

- Auth: manager.
- Also available through legacy alias:
  - `PATCH /api/v1/manager/products/:productId/targeting`
- Purpose:
  - manager requests quick visibility change for a product already checked out in their branch
  - route no longer directly mutates product by default
- Body:

```json
{
  "branchId": "branch-uuid",
  "visibility": "PUBLIC | TOP_SHELF | USER_TIER | TARGETED_USER | PRIVATE | STAFF",
  "minCustomerTier": "REGULAR | VIP | ULTRA_VIP",
  "targetUserIds": ["customer-user-id"],
  "visibilityNote": "Optional note",
  "reason": "Why visibility should change"
}
```

- Behavior:
  - backend checks branch access
  - backend checks product is currently possessed by that branch
  - backend enforces quick-visibility transition rules
  - backend rejects duplicate pending requests for the same branch and product
  - returns `202` with `approvalRequest` when admin approval is required
  - returns `200` and applies immediately when a previous approved request enabled `autoApproveFuture`
- Frontend use:
  - treat `202` as "submitted for admin approval"
  - treat `200` as "applied immediately"
  - if manager gets `QUICK_VISIBILITY_NOT_ALLOWED`, send them to full admin-managed edit flow instead of retrying

## Frontend Handling Checklist

- On every admin layout load, call `GET /api/v1/user/me`.
- If `role !== "ADMIN"`, redirect out of admin area.
- If `accountAccess.canAccessRoleRoutes === false`, show restriction UI instead of dashboard.
- For any route that returns `202`, show a pending approval toast and update request history UI.
- For main admin inspection flow, approve product create/edit/visibility requests with override fields in the same decision request.
- For user detail page:
  - call `GET /api/v1/admin/users/:userId`
  - main admin tabs should additionally call audit-log and approval-request routes
- For branch network page:
  - call `GET /api/v1/admin/analytics/branches`
- For branch detail page:
  - call `GET /api/v1/admin/branches/:branchId`
  - call branch audit logs lazily when audit tab opens

## Suggested Next.js Screen Mapping

- `/admin`:
  - `GET /api/v1/user/me`
  - `GET /api/v1/admin/approval-requests`
  - `GET /api/v1/admin/analytics/branches`
- `/admin/products`:
  - `GET /api/v1/admin/products`
- `/admin/products/[productId]`:
  - `GET /api/v1/admin/products/:productId`
  - `PATCH /api/v1/admin/products/:productId`
  - `PATCH /api/v1/admin/products/:productId/quick-visibility`
- `/admin/users`:
  - `GET /api/v1/admin/users`
- `/admin/users/[userId]`:
  - `GET /api/v1/admin/users/:userId`
  - `PATCH /api/v1/admin/users/:userId/permissions`
  - `POST /api/v1/admin/users/:userId/restrictions`
  - `POST /api/v1/admin/users/:userId/ban`
  - `PATCH /api/v1/admin/users/:userId/status`
  - `PATCH /api/v1/admin/users/:userId/admin-actions/resolve`
- `/admin/users/[userId]/audit-logs`:
  - `GET /api/v1/admin/users/:userId/audit-logs`
- `/admin/users/[userId]/requests`:
  - `GET /api/v1/admin/users/:userId/approval-requests`
- `/admin/branches`:
  - `GET /api/v1/admin/analytics/branches`
- `/admin/branches/[branchId]`:
  - `GET /api/v1/admin/branches/:branchId`
- `/admin/branches/[branchId]/audit-logs`:
  - `GET /api/v1/admin/branches/:branchId/audit-logs`
