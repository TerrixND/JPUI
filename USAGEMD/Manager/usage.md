# Manager Full Usage

Last updated: 2026-03-02  
Base path: `/api/v1/manager`  
Content-Type for write routes: `application/json`

## 1) Auth, Role, and Branch Scope

### Auth
- Every route in this file is protected by:
1. `authorize`
2. `requireRole("MANAGER")`

### Branch scope
- Most manager routes work inside the manager's assigned branch scope.
- If a manager belongs to exactly one branch, `branchId` can usually be omitted.
- If a manager belongs to multiple branches, routes that need one concrete branch will reject unless `branchId` is provided.
- Some actions are branch-admin-only. In current backend behavior, branch-admin authority is based on branch membership authority, not a separate top-level auth role.

### Important current-state summary
- `GET /branch-users` exists and is the current route for branch-scoped staff discovery, but it returns all active branch memberships, not only sales + managers.
- `GET /products` now returns products whose visibility is not `PRIVATE`, including signed media URLs that managers can preview.
- `GET /customers` now exists for targeting-page customer discovery with branch scope, pagination, tier filter, search, and optional product targeting annotation.
- Branch product selection exists for non-`PRIVATE` products and only branch admin can submit the request.
- Inventory request creation exists, but the exact chained flow "sales requests -> manager requests -> admin approves -> sales request auto-approved" is not fully exposed as a dedicated route set in manager API.
- Commission policy creation for sales already exists and is close to your requested UI flow.
- Branch admin can now update product media visibility for branch-selected or branch-held non-`PRIVATE` products through manager API.

### Visibility model
- There are 3 visibility layers in current backend behavior.

#### 1. Main product visibility
- `PRIVATE`: only admin should access the product.
- `STAFF`: admin, manager, and sales can access the product.
- `PUBLIC`: staff and all users can access the product.
- `TOP_SHELF`: staff and all users can access the product, and frontend can place it in special showcase areas.
- `USER_TIER`: staff can access the product, and customers can access it when their tier is at or above `minCustomerTier`.
- `TARGETED_USER`: staff can access the product, and explicitly targeted customers can access it.
- Manager-facing product pages now treat "manager-visible product" as any product whose main visibility is not `PRIVATE`.

#### 2. Public/customer-facing product media
- Media visibility presets here are `PUBLIC`, `TOP_SHELF`, `USER_TIER`, `TARGETED_USER`, and `PRIVATE`.
- Staff can see all of these media variants as long as the product itself is not `PRIVATE`.
- Customer access is controlled by media visibility plus product visibility.
- Tier inheritance is cumulative:
1. `REGULAR` sees `REGULAR`
2. `VIP` sees `REGULAR + VIP`
3. `ULTRA_VIP` sees `REGULAR + VIP + ULTRA_VIP`

#### 3. Role-based staff media
- Role-based media is separate from customer-facing media.
- Visibility options are `ADMIN`, `MANAGER`, and `SALES`.
- Customers never see these files.
- Role inheritance is cumulative:
1. admin sees `ADMIN + MANAGER + SALES`
2. manager sees `MANAGER + SALES`
3. sales sees `SALES`

#### Branch admin edit rule
- Branch admin can edit media visibility through manager API, but only for non-`PRIVATE` products that are already selected for or held by the branch.

---

## 2) Requested UI Flow vs Current Backend

### A) Get all sales, managers, and branch admins within branch scope
- Current route: `GET /branch-users`
- Current behavior: returns all active users in the branch with profile and commission context
- Frontend behavior needed today: filter returned rows to branch staff only
- Recommended filter:
1. keep `user.role === "SALES"`
2. keep `user.role === "MANAGER"`
- Current branch-admin identification:
1. branch admin is inferred from manager branch authority
2. in branch user rows, `isPrimary: true` is the practical flag the UI should treat as branch-admin

### B) Get products for branch where visibility is not PRIVATE
- Requested by flow: yes
- Current manager route support: yes
- Current `GET /products` behavior: returns all non-`PRIVATE` products and their manager-visible media
- Result: this manager catalog is available in manager API

### C) Branch inventory selection and possession request chain
- Requested by flow:
1. branch admin/manager selects products for branch inventory
2. branch admin/manager requests possession from admin
3. sales can request possession from branch admin/manager
4. admin approval should also satisfy the upstream sales request automatically
- Current backend support:
1. branch product request exists: `POST /branch-products`
2. this request handles products whose visibility is not `PRIVATE`
3. only branch-admin scope can submit it
4. approval happens later in admin module
5. inventory request exists: `POST /inventory-requests`
6. product checkout to salesperson exists: `POST /appointments/:appointmentId/possessions`
- Current gap:
1. no dedicated manager route was found for "salesperson submits possession request to manager"
2. no dedicated manager route was found that stores a two-step request chain and auto-resolves the sales request when admin approves

### D) Commission policy for sales
- Requested by flow: yes
- Current route support: yes
- Route: `POST /commission-policies`
- Supported policy shapes:
1. default salesperson rule: omit both `productTier` and `productId`
2. tier-specific rule: send `productTier`
3. product-specific rule: send `productId`

### E) Targeting users page
- Requested by flow:
1. get all customers filtered by tier
2. get all non-private products
3. set/edit product target customers
- Current backend support:
1. customer list route under manager API: available through `GET /customers`
2. non-private product catalog under manager API: available through `GET /products`
3. update product targeting: available through `PATCH /products/:productId/targeting`

---

## 3) Route Index For Manager Functions

### Staff and branch scope
- `GET /branch-users`
- `GET /customers`
- `GET /my-branch`
- `PATCH /my-branch`

### Product and branch inventory workflow
- `GET /products`
- `POST /branch-products`
- `POST /branch-products/requests`
- `GET /branch-products/requests`
- `GET /branch-requests`
- `PATCH /products/:productId/quick-visibility`
- `PATCH /products/:productId/targeting`
- `PATCH /products/:productId/media/:mediaId/visibility`

### Appointment, inventory, and possession
- `GET /appointments/pending`
- `PATCH /appointments/:appointmentId/approve`
- `POST /inventory-requests`
- `POST /appointments/:appointmentId/possessions`

### Sales commission
- `POST /commission-policies`
- `GET /salespersons/:salespersonUserId/performance`
- `GET /salespersons/:salespersonUserId/possessions`

### Legacy aliases still supported
- `POST /branchProducts`
- `GET /branchRequests`
- `GET /getProducts`
- `GET /getMybranch`
- `PATCH /getMybranch`
- `GET /getBranchUsers`
- `GET /getBranchUsres`

---

## 4) Branch Users Page

### GET `/branch-users`
Purpose: get branch-scoped users with branch membership, role, status, profile data, restrictions, and commission context.

### Query
- `branchId` optional UUID if manager has exactly one branch

### Current usage for your UI
- Use this as the source for:
1. sales
2. branch managers
3. branch admin
- Current backend does not provide a staff-only route here.
- The frontend should filter the returned rows to:
1. `user.role === "SALES"`
2. `user.role === "MANAGER"`

### Response shape
```json
{
  "branch": {
    "id": "branch-id",
    "code": "BKK-001",
    "name": "Bangkok Main"
  },
  "totalUsers": 6,
  "users": [
    {
      "membershipId": "membership-id",
      "memberRole": "MANAGER",
      "isPrimary": true,
      "assignedAt": "2026-03-01T00:00:00.000Z",
      "user": {
        "id": "user-id",
        "email": "manager@example.com",
        "role": "MANAGER",
        "status": "ACTIVE",
        "managerProfile": {
          "displayName": "Branch Admin"
        },
        "accessRestrictions": []
      },
      "commissions": {
        "salespersonPolicies": [],
        "activeSalespersonPolicies": [],
        "productAllocations": [],
        "summary": {
          "salespersonPolicyCount": 0,
          "activeSalespersonPolicyCount": 0,
          "productAllocationCount": 0,
          "highestActivePolicyRate": null,
          "highestProductAllocationRate": null
        }
      }
    }
  ]
}
```

### Practical frontend mapping
- Branch admin:
1. `user.role === "MANAGER"`
2. `isPrimary === true`
- Branch manager:
1. `user.role === "MANAGER"`
2. `isPrimary === false`
- Sales:
1. `user.role === "SALES"`

### Gap note
- If you want a backend route that already returns only branch staff and excludes other branch users, that route does not exist yet.

---

## 5) Branch Product Page

### Requested UI behavior
- show products for branch where product visibility is anything except `PRIVATE`

### Current manager route
### GET `/products`
Purpose today: list non-archived products whose visibility is not `PRIVATE`, include manager-visible media, and indicate whether they were already selected for the branch.

### Query
- `branchId` optional UUID if manager has exactly one branch

### Current response shape
```json
{
  "branchId": "branch-id",
  "count": 2,
  "products": [
    {
      "id": "product-id",
      "sku": "SKU-001",
      "name": "Example Product",
      "tier": "STANDARD",
      "status": "AVAILABLE",
      "visibility": "STAFF",
      "media": [
        {
          "id": "media-id",
          "type": "IMAGE",
          "url": "https://signed.example.com/...",
          "originalUrl": "products/product-id/2026/03/admin-user/file.jpg",
          "audience": "PUBLIC",
          "visibilitySections": ["PRODUCT_PAGE"]
        }
      ],
      "saleRange": {
        "min": 20000,
        "max": 30000
      },
      "isSelectedForBranch": true,
      "branchCommissionRate": 7,
      "projectedBranchCommissionRange": {
        "min": 1400,
        "max": 2100
      }
    }
  ]
}
```

### Current backend behavior
1. include only products whose visibility is not `PRIVATE`
2. exclude archived products
3. include manager-visible public media and role-based media with signed URLs
4. annotate branch selection state using branch product allocation data

### What this means for frontend
- Use this route for manager product catalog pages and targeting pages.
- `media` already contains signed preview URLs the manager can open directly.
- Product media in this response follows your staff-visibility rules:
1. managers do not receive `PRIVATE` products here
2. they do receive all public/customer-facing media for non-`PRIVATE` products
3. they also receive role-based media allowed for `MANAGER` and `SALES`

---

## 6) Branch Inventory Selection Request

### POST `/branch-products`
Aliases:
- `POST /branch-products/requests`
- `POST /branchProducts`

Purpose today: submit a branch product selection request for main-admin approval.

### Body
- `branchId` optional UUID if current manager is branch admin for exactly one branch
- `productIds` required array of product UUIDs or comma-separated UUID string
- `requestedCommissionRate` optional number from `0` to `100`
- `rate` optional alias of `requestedCommissionRate`
- `note` optional string
- `requestReason` optional alias of `note`

### Example
```json
{
  "branchId": "branch-uuid",
  "productIds": ["product-uuid-1", "product-uuid-2"],
  "requestedCommissionRate": 7,
  "note": "Please approve for branch inventory"
}
```

### Current backend rules
- Only branch-admin scope can submit this route.
- Products must currently be:
1. visibility is not `PRIVATE`
2. not archived
- The request becomes a pending admin approval request.
- This route is now aligned with the non-`PRIVATE` branch inventory selector rule.

### 201 response
```json
{
  "message": "Branch product request submitted for main admin approval",
  "code": "BRANCH_PRODUCT_REQUEST_SUBMITTED",
  "request": {
    "id": "approval-request-id",
    "actionType": "USER_STATUS_CHANGE",
    "status": "PENDING",
    "requestPayload": {
      "approvalScope": "BRANCH_PRODUCT_SELECTION",
      "approvalFlow": "MANAGER_PRODUCT_SELECTION",
      "branchId": "branch-uuid",
      "productIds": ["product-uuid-1", "product-uuid-2"],
      "requestedCommissionRate": 7
    }
  }
}
```

### Common validation errors
- `403 FORBIDDEN`: manager is not branch admin for the branch
- `400 VALIDATION_ERROR`: invalid product ids, archived product, or product is `PRIVATE`
- `409 BRANCH_PRODUCT_REQUEST_ALREADY_PENDING`: same product already exists in overlapping pending request

### GET `/branch-products/requests`
Aliases:
- `GET /branch-requests`
- `GET /branchRequests`

Purpose: list manager-visible branch product selection requests.

### Query
- `branchId` optional UUID
- `status` optional `PENDING | APPROVED | REJECTED | CANCELLED`
- `limit` optional integer, default `50`

### Response shape
```json
{
  "count": 1,
  "records": [
    {
      "id": "approval-request-id",
      "status": "PENDING",
      "branch": {
        "id": "branch-id",
        "code": "BKK-001",
        "name": "Bangkok Main"
      },
      "requestedProducts": [
        {
          "id": "product-id",
          "sku": "SKU-001"
        }
      ]
    }
  ]
}
```

### Admin dependency
- Manager API only submits and reads the request.
- Main admin must approve it in admin API before the branch selection becomes active.

---

## 7) Current Inventory and Possession Flow

### What exists today

#### GET `/appointments/pending`
Purpose: get pending appointments in manager branch scope.

#### Query
- `branchId` optional UUID

#### PATCH `/appointments/:appointmentId/approve`
Purpose: confirm or cancel an appointment and optionally assign salesperson.

#### Body
- `status` optional `CONFIRMED | CANCELLED`, default `CONFIRMED`
- `salespersonUserId` optional UUID
- `notes` optional string

#### POST `/inventory-requests`
Purpose: create a branch inventory pull request from main inventory or branch pool.

#### Body
- `branchId` required UUID
- `appointmentId` required UUID
- `productId` required UUID
- `appointmentItemId` optional UUID
- `fromLocation` optional `MAIN | BRANCH_POOL`, default `MAIN`
- `managerNote` optional string

#### Current backend behavior
- The request is created directly at main-admin stage with manager decision data already filled in.
- Practically, manager approval is already considered done when this route is created.
- This is the closest current backend behavior to "manager requests possession from admin".

#### 201 response example
```json
{
  "id": "inventory-request-id",
  "branchId": "branch-id",
  "appointmentId": "appointment-id",
  "productId": "product-id",
  "fromLocation": "MAIN",
  "status": "PENDING_MAIN"
}
```

#### POST `/appointments/:appointmentId/possessions`
Purpose: check out a product to a salesperson for an appointment.

#### Body
- `productId` required UUID
- `salespersonUserId` required UUID
- `dueBackAt` optional datetime
- `note` optional string

#### Current backend behavior
- Creates a checkout possession record
- Sets product status to `BUSY`
- Updates the appointment item fulfillment state

### Important gap against your requested flow
- The backend does not currently expose a dedicated salesperson-to-manager possession request route in manager API.
- The backend also does not currently expose a dedicated linked request chain where:
1. sales creates request to manager
2. manager escalates to admin
3. admin approval auto-marks the original sales request approved
- Current implementation is closer to:
1. manager approves appointment
2. manager creates inventory request
3. admin/main stage handles the inventory request
4. manager allocates possession to salesperson

---

## 8) Sales Commission Policy

### POST `/commission-policies`
Purpose: create salesperson commission policy inside manager branch scope.

### Body
- `branchId` required UUID when manager has multiple branches
- `salespersonUserId` required UUID
- `rate` required number from `0` to `100`
- `productTier` optional `STANDARD | VIP | ULTRA_RARE`
- `productId` optional UUID
- `activeFrom` optional datetime
- `activeTo` optional datetime
- `priority` optional integer, default `100`
- `note` optional string

### Policy meaning
- Default salesperson rule:
1. send `salespersonUserId`
2. send `rate`
3. omit `productTier`
4. omit `productId`
- Tier-specific rule:
1. send `productTier`
2. omit `productId`
- Product-specific rule:
1. send `productId`
2. `productId` takes precedence over generic tier/default use case

### Notes for your UI flow
- Your UI can auto-select current branch.
- Backend still needs `branchId` when the manager has access to more than one branch.
- `priority` exists in backend but can stay `100` in your UI if you do not want to expose it.

### Example: default policy for one salesperson
```json
{
  "branchId": "branch-uuid",
  "salespersonUserId": "sales-user-uuid",
  "rate": 5,
  "activeFrom": "2026-03-01T00:00:00.000Z",
  "activeTo": "2026-12-31T23:59:59.999Z",
  "note": "Default branch salesperson commission"
}
```

### Example: tier-specific policy
```json
{
  "branchId": "branch-uuid",
  "salespersonUserId": "sales-user-uuid",
  "rate": 4,
  "productTier": "VIP",
  "activeFrom": "2026-03-01T00:00:00.000Z",
  "note": "VIP tier commission"
}
```

### Example: product-specific policy
```json
{
  "branchId": "branch-uuid",
  "salespersonUserId": "sales-user-uuid",
  "rate": 10,
  "productId": "product-uuid",
  "activeFrom": "2026-03-01T00:00:00.000Z",
  "note": "Specific SKU commission"
}
```

### 201 response
- Returns the created `CommissionPolicy` row.

### Related read routes
- `GET /salespersons/:salespersonUserId/performance`
- `GET /salespersons/:salespersonUserId/possessions`

Use these to support manager-side performance and possession drill-down for each salesperson.

---

## 9) Targeting Users Page

### Requested UI behavior
- get all customers
- filter customers by `REGULAR | VIP | ULTRA_VIP`
- get all products except `PRIVATE`
- open product profile
- assign selected customers who can see the product
- remove selected customers with `-` action

### Current backend support

#### Customer discovery route under manager API
### GET `/customers`
Purpose: list customers for targeting UI with optional tier, status, search, and product-target annotation.

#### Query
- `branchId` optional UUID if manager has exactly one branch
- `page` optional integer, default `1`
- `limit` optional integer, default `50`, max `200`
- `customerTier` optional alias of `tier`
- `tier` optional `REGULAR | VIP | ULTRA_VIP`
- `accountStatus` optional `ACTIVE | RESTRICTED | BANNED | TERMINATED`
- `search` optional string matching display name, phone, line, city, email, or user ID
- `productId` optional UUID to mark which customers are already targeted for one branch-held product

#### Response shape
```json
{
  "branchId": "branch-uuid",
  "page": 1,
  "limit": 50,
  "total": 2,
  "totalPages": 1,
  "product": {
    "id": "product-uuid",
    "visibility": "TARGETED_USER",
    "targetedUsersCount": 1
  },
  "records": [
    {
      "userId": "customer-user-1",
      "displayName": "VIP Buyer",
      "tier": "VIP",
      "user": {
        "id": "customer-user-1",
        "email": "vip@example.com",
        "status": "ACTIVE"
      },
      "isTargetedForProduct": true
    }
  ]
}
```

#### Non-private product list under manager API
- Available through `GET /products`

#### Product targeting update
### PATCH `/products/:productId/targeting`
Alias:
- `PATCH /products/:productId/quick-visibility`

Purpose: update visibility and explicit customer targets for a product already held by the branch.

### Path
- `productId` required UUID

### Body
- `branchId` required UUID
- `visibility` optional `PRIVATE | STAFF | PUBLIC | TOP_SHELF | USER_TIER | TARGETED_USER`
- `minCustomerTier` optional `REGULAR | VIP | ULTRA_VIP`
- `userIds` optional array of customer user IDs
- `targetUserIds` optional alias of `userIds`
- `visibilityNote` optional string

### Important current backend rules
- The branch must currently hold or possess the product.
- `userIds` must belong to users with customer role.
- This route is a quick-visibility / target-access update route, not a general product catalog route.

### Example: target only selected customers
```json
{
  "branchId": "branch-uuid",
  "visibility": "TARGETED_USER",
  "userIds": ["customer-user-1", "customer-user-2"],
  "visibilityNote": "Invite-only release"
}
```

### Example: clear all specific targeted customers
```json
{
  "branchId": "branch-uuid",
  "visibility": "PUBLIC",
  "userIds": []
}
```

### Current frontend guidance
- To remove one customer from the targeted list, send the full remaining `userIds` array.
- To remove all explicit targeted customers, send `userIds: []`.

### Product media visibility management
### PATCH `/products/:productId/media/:mediaId/visibility`
Purpose: branch-admin-safe media visibility editing for non-`PRIVATE` products already selected for or held by the branch.

#### Path
- `productId` required UUID
- `mediaId` required UUID

#### Body
- `branchId` optional UUID if branch admin has exactly one branch
- `visibilityPreset` optional `PUBLIC | TOP_SHELF | USER_TIER | TARGETED_USER | PRIVATE | ADMIN | MANAGER | SALES`
- `visibility` optional alias of `visibilityPreset`
- `tier` or `minCustomerTier` optional when using `USER_TIER`
- `targetUserIds` or `userIds` optional when using `TARGETED_USER`
- `allowedRoles` optional if using direct `ROLE_BASED` payload form
- `visibilitySections` optional direct low-level override
- `audience` optional direct low-level override

#### Important current backend rules
- Only branch admin can use this route.
- The product must not be `PRIVATE`.
- The product must already be selected for or held by the branch.
- This route edits visibility metadata only. It does not upload a new file.
- Customers never see role-based media.

#### Example: move one video to top shelf
```json
{
  "branchId": "branch-uuid",
  "visibilityPreset": "TOP_SHELF"
}
```

#### Example: make one image visible only to VIP and above
```json
{
  "branchId": "branch-uuid",
  "visibilityPreset": "USER_TIER",
  "minCustomerTier": "VIP"
}
```

#### Example: make one PDF visible to both manager and sales staff
```json
{
  "branchId": "branch-uuid",
  "allowedRoles": ["MANAGER", "SALES"]
}
```

---

## 10) Branch Overview Routes

### GET `/my-branch`
Purpose: get one branch detail plus approved selected products and branch selection analytics.

### Query
- `branchId` optional UUID if manager only belongs to one branch

### Useful for UI
- branch profile page
- selected product summary
- branch-level selected product analytics

### GET `/analytics/branches`
Purpose: manager branch analytics for approved branch-product selections and related request stats.

### Query
- `branchId` optional UUID
- `requestStatus` optional `PENDING | APPROVED | REJECTED | CANCELLED`

### Useful for UI
- summary cards
- request counters
- selected product totals

---

## 11) What Is Missing For Your Intended Manager Module

The following parts of your requested manager flow are still not implemented in current manager API:

1. A dedicated manager route that returns only branch staff rows for `SALES`, branch `MANAGER`, and branch admin without requiring frontend filtering.
2. A dedicated sales-originated possession request route that managers can review.
3. A linked approval chain where admin approval automatically resolves the earlier sales possession request record.

---

## 12) Practical Frontend Mapping

### Branch staff page
- Call `GET /branch-users`
- Filter rows to `MANAGER` and `SALES`
- Treat `MANAGER + isPrimary=true` as branch admin

### Product selection page
- Use `GET /products`
- This route now matches the non-`PRIVATE` manager catalog behavior
- Use each product's `media` array for direct preview URLs

### Branch inventory request page
- Current closest flow:
1. approve appointment
2. create inventory request
3. wait for upstream approval process
4. create possession for salesperson

### Commission page
- Use `POST /commission-policies`
- Omit `productTier` and `productId` for default salesperson commission
- Send `productTier` for tier-based rule
- Send `productId` for SKU-specific rule

### Targeting page
- Use `GET /customers` for customer discovery
- Use `GET /products` for non-`PRIVATE` product discovery
- Use `PATCH /products/:productId/targeting` for product targeting
- Use `PATCH /products/:productId/media/:mediaId/visibility` when branch admin needs to adjust media visibility
