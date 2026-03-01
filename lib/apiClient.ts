import supabase from "./supabase";

export const API_BASE_PATH = "/api/v1";
const PUBLIC_API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

export type MediaSection = "PRODUCT_PAGE" | "TOP_SHELF" | "VIP" | "PRIVATE";
export type MediaAudience = "PUBLIC" | "TARGETED" | "ADMIN_ONLY" | "ROLE_BASED" | "PRIVATE";
export type MediaType = "IMAGE" | "VIDEO" | "PDF" | "CERTIFICATE";
export type MediaRole = "ADMIN" | "MANAGER" | "SALES";
export type CustomerTier = "REGULAR" | "VIP" | "ULTRA_VIP";
export type MediaVisibilityPreset =
  | "PUBLIC"
  | "TOP_SHELF"
  | "USER_TIER"
  | "TARGETED_USER"
  | "PRIVATE"
  | "ADMIN"
  | "MANAGER"
  | "SALES";
export type MediaSlot =
  | "PUBLIC_THUMBNAIL"
  | "PUBLIC_FEATURE_VIDEO"
  | "PUBLIC_GALLERY"
  | "PUBLIC_CERTIFICATE"
  | "ROLE_REFERENCE"
  | "CONSIGNMENT_CONTRACT";

type ApiErrorPayload = {
  message?: unknown;
  code?: unknown;
  reason?: unknown;
};

type JsonRecord = Record<string, unknown>;

export class ApiClientError extends Error {
  status: number;
  code: string | null;
  reason: string | null;
  payload: unknown;

  constructor({
    message,
    status,
    code,
    reason,
    payload,
  }: {
    message: string;
    status: number;
    code?: string | null;
    reason?: string | null;
    payload?: unknown;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code ?? null;
    this.reason = reason ?? null;
    this.payload = payload;
  }
}

export type MediaPresignResponse = {
  uploadUrl: string;
  key: string;
  url: string | null;
  expiresAt: string | null;
  uploadMethod: string;
  uploadHeaders: Record<string, string>;
  productId: string | null;
  consignmentAgreementId: string | null;
};

export type MediaRecord = {
  id: string;
  productId: string | null;
  consignmentAgreementId: string | null;
  type: MediaType | string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
  slot: MediaSlot | null;
  visibilitySections: MediaSection[];
  audience: MediaAudience | null;
  allowedRoles: MediaRole[];
  minCustomerTier: CustomerTier | null;
  targetUserIds: string[];
  visibilityPreset: MediaVisibilityPreset | null;
};

export type PublicMediaUrlResponse = {
  id: string;
  type: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string;
};

export type AdminMediaUrlResponse = {
  id: string;
  productId: string | null;
  consignmentAgreementId: string | null;
  type: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string;
  slot: MediaSlot | null;
  visibilitySections: MediaSection[];
  audience: MediaAudience | null;
  allowedRoles: MediaRole[];
  minCustomerTier: CustomerTier | null;
  targetUsers: Array<{
    userId: string;
  }>;
  visibilityPreset: MediaVisibilityPreset | null;
};

export type AdminAuditLogRow = {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  message: string | null;
  details: unknown;
  createdAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  raw: JsonRecord;
};

export type AdminAuditLogsResponse = {
  items: AdminAuditLogRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  raw: unknown;
};

export type ClearAdminAuditLogsResponse = {
  message: string;
  backupFileName: string | null;
  backupFileSizeBytes: number | null;
  backupRecordCount: number | null;
  backupGeneratedAt: string | null;
  raw: unknown;
};

export type AdminInternalErrorLogRow = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  source: string | null;
  process: string | null;
  functionName: string | null;
  message: string | null;
  stack: string | null;
  colorCode: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string | null;
  raw: JsonRecord;
};

export type AdminInternalErrorLogsResponse = {
  items: AdminInternalErrorLogRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  raw: unknown;
};

export type ClearAdminInternalErrorLogsResponse = {
  message: string;
  deletedCount: number | null;
  backupFileName: string | null;
  backupFileSizeBytes: number | null;
  backupRecordCount: number | null;
  backupGeneratedAt: string | null;
  raw: unknown;
};

export type AdminLogBackupFile = {
  fileName: string;
  sizeBytes: number | null;
  recordCount: number | null;
  generatedAt: string | null;
  type: string | null;
  raw: JsonRecord;
};

export type LogHistoryType = "all" | "internal" | "audit" | "product" | "other";

export type AdminLogHistoryItem = {
  fileName: string;
  relativePath: string | null;
  category: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  data: unknown;
  parseError: string | null;
  raw: JsonRecord;
};

export type AdminLogHistoryResponse = {
  type: LogHistoryType;
  limit: number;
  count: number;
  items: AdminLogHistoryItem[];
  raw: unknown;
};

export type StaffRuleBranch = {
  id: string;
  code: string | null;
  name: string | null;
  status: string | null;
};

export type StaffRuleUser = {
  id: string;
  email: string | null;
  role: string | null;
};

export type StaffRuleVisibilityRole = "ADMIN" | "MANAGER" | "SALES";
export type StaffRuleManagerType = "STANDALONE" | "BRANCH_MANAGER" | "BRANCH_ADMIN";

export type StaffRuleAdminCapabilities = {
  canReadProducts?: boolean;
  canCreateProducts?: boolean;
  canEditProducts?: boolean;
  canHandleRequests?: boolean;
  canDeleteLogs?: boolean;
  canManageProductVisibility?: boolean;
  canManageStaffRules?: boolean;
  canRestrictUsers?: boolean;
  canBanUsers?: boolean;
};

export type StaffRuleManagerCapabilities = {
  canCreateStaffRules?: boolean;
  canApproveRequests?: boolean;
  canRequestProductsFromAdmin?: boolean;
  canRequestManagerRestrictions?: boolean;
  canRequestManagerBans?: boolean;
  canRestrictSubordinates?: boolean;
  canBanSubordinates?: boolean;
  canLimitSubordinatePermissions?: boolean;
};

export type StaffRuleAdminPermissionConfig = {
  visibilityRole?: StaffRuleVisibilityRole | string | null;
  capabilities?: StaffRuleAdminCapabilities | null;
};

export type StaffRuleManagerPermissionConfig = {
  managerType?: StaffRuleManagerType | string | null;
  visibilityRole?: StaffRuleVisibilityRole | string | null;
  capabilities?: StaffRuleManagerCapabilities | null;
};

export type StaffRulePermissionPayload =
  | StaffRuleAdminPermissionConfig
  | StaffRuleManagerPermissionConfig
  | {
      admin?: StaffRuleAdminPermissionConfig;
      manager?: StaffRuleManagerPermissionConfig;
    }
  | JsonRecord;

export type StaffOnboardingRule = {
  id: string;
  role: string;
  permissions: JsonRecord | null;
  email: string | null;
  emailNormalized: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  displayName: string | null;
  lineId: string | null;
  note: string | null;
  branchId: string | null;
  setAsPrimaryManager: boolean;
  expiresAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdByUserId: string | null;
  claimedByUserId: string | null;
  revokedByUserId: string | null;
  branch: StaffRuleBranch | null;
  createdByUser: StaffRuleUser | null;
  claimedByUser: StaffRuleUser | null;
  revokedByUser: StaffRuleUser | null;
  status: string;
  raw: JsonRecord;
};

export type CreateStaffRulePayload = {
  role: string;
  email: string;
  phone: string;
  displayName?: string | null;
  lineId?: string | null;
  note?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  setAsPrimaryManager?: boolean;
  expiresAt?: string | null;
  permissions?: StaffRulePermissionPayload | null;
  permission?: StaffRulePermissionPayload | null;
};

export type AdminLogBackupsResponse = {
  files: AdminLogBackupFile[];
  raw: unknown;
};

export type AdminAccountStatus =
  | "ACTIVE"
  | "RESTRICTED"
  | "BANNED"
  | "SUSPENDED"
  | "TERMINATED";

export type AdminUserRole = "ADMIN" | "MANAGER" | "SALES" | "CUSTOMER";
export type AdminBranchStatus = "ACTIVE" | "INACTIVE";
export type AdminInventoryRequestStatus =
  | "PENDING_MANAGER"
  | "PENDING_MAIN"
  | "APPROVED"
  | "REJECTED"
  | "FULFILLED"
  | "CANCELLED";

export type AdminPageResponseMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminUserBranchMembership = {
  id: string;
  branchId: string;
  memberRole: string | null;
  isPrimary: boolean;
  assignedAt: string | null;
  endedAt: string | null;
  branch: {
    id: string;
    code: string | null;
    name: string | null;
    status: string | null;
  } | null;
};

export type AdminUserListItem = {
  id: string;
  supabaseUserId: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  isMainAdmin: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  deactivatedAt: string | null;
  terminatedAt: string | null;
  displayName: string | null;
  phone: string | null;
  lineId: string | null;
  customerTier: CustomerTier | null;
  branchMemberships: AdminUserBranchMembership[];
  raw: JsonRecord;
};

export type AdminUsersResponse = AdminPageResponseMeta & {
  items: AdminUserListItem[];
  raw: unknown;
};

export type AccountAccessState = {
  code: string | null;
  blockedScope: string | null;
  canAuthenticate: boolean | null;
  canAccessRoleRoutes: boolean | null;
  remainingMs: number | null;
  raw: JsonRecord | null;
};

export type UserMeResponse = {
  id: string | null;
  supabaseUserId: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  isSetup: boolean;
  isMainAdmin: boolean;
  accountAccess: AccountAccessState | null;
  raw: unknown;
};

export type AdminAccessControlType = "RESTRICTION" | "BAN";
export type AdminRestrictionMode = "ACCOUNT" | "ADMIN_ACTIONS";
export type AdminActionBlock =
  | "PRODUCT_CREATE"
  | "PRODUCT_EDIT"
  | "PRODUCT_VISIBILITY_MANAGE"
  | "PRODUCT_DELETE"
  | "INVENTORY_REQUEST_DECIDE"
  | "USER_ACCESS_MANAGE"
  | "APPROVAL_REVIEW"
  | "STAFF_RULE_MANAGE"
  | "LOG_DELETE";
export type AdminApprovalActionType = "USER_STATUS_CHANGE" | "USER_RESTRICTION_UPSERT" | "USER_BAN";
export type AdminApprovalRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type AdminApprovalDecision = "APPROVE" | "REJECT";

export type AdminUserReference = {
  id: string;
  email: string | null;
  role: string | null;
  status: string | null;
  isMainAdmin: boolean;
  raw: JsonRecord;
};

export type AdminUserAccessRestriction = {
  id: string;
  userId: string;
  type: AdminAccessControlType | string;
  reason: string | null;
  note: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  liftedAt: string | null;
  statusBeforeAction: string | null;
  statusRestoredAt: string | null;
  roleDowngradedFrom: string | null;
  roleRestoredAt: string | null;
  metadata: unknown;
  createdAt: string | null;
  updatedAt: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdByUser: AdminUserReference | null;
  updatedByUser: AdminUserReference | null;
  raw: JsonRecord;
};

export type AdminApprovalRequest = {
  id: string;
  actionType: AdminApprovalActionType | string;
  status: AdminApprovalRequestStatus | string;
  targetUserId: string;
  requestedByUserId: string | null;
  reviewedByUserId: string | null;
  requestReason: string | null;
  decisionNote: string | null;
  requestPayload: unknown;
  createdAt: string | null;
  updatedAt: string | null;
  decidedAt: string | null;
  targetUser: AdminUserReference | null;
  requestedByUser: AdminUserReference | null;
  reviewedByUser: AdminUserReference | null;
  raw: JsonRecord;
};

export type AdminUserDetail = {
  id: string;
  supabaseUserId: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  isMainAdmin: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  deactivatedAt: string | null;
  terminatedAt: string | null;
  adminProfile: JsonRecord | null;
  managerProfile: JsonRecord | null;
  salespersonProfile: JsonRecord | null;
  customerProfile: JsonRecord | null;
  branchMemberships: AdminUserBranchMembership[];
  accessRestrictions: AdminUserAccessRestriction[];
  activeAccessControlsCount: number;
  activeAccessControls: AdminUserAccessRestriction[];
  approvalRequestsSubmitted: AdminApprovalRequest[];
  approvalRequestsTargeted: AdminApprovalRequest[];
  raw: JsonRecord;
};

export type AdminApprovalRequestsResponse = AdminPageResponseMeta & {
  items: AdminApprovalRequest[];
  raw: unknown;
};

export type AdminActionResponse = {
  statusCode: number;
  message: string | null;
  code: string | null;
  approvalRequest: AdminApprovalRequest | null;
  request: AdminApprovalRequest | null;
  executionResult: unknown;
  data: JsonRecord | null;
  raw: unknown;
};

export type AdminBranchManager = {
  id: string;
  email: string | null;
  role: string | null;
  status: string | null;
  displayName: string | null;
  phone: string | null;
  lineId: string | null;
  membershipId: string | null;
  isPrimaryMembership: boolean;
  assignedAt: string | null;
  raw: JsonRecord;
};

export type AdminBranchWithManagersRecord = {
  id: string;
  code: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  primaryManagerUserId: string | null;
  primaryManager: AdminBranchManager | null;
  managerCount: number;
  managers: AdminBranchManager[];
  raw: JsonRecord;
};

export type AdminBranchesWithManagersResponse = AdminPageResponseMeta & {
  items: AdminBranchWithManagersRecord[];
  raw: unknown;
};

export type AdminBranchNetworkRecord = AdminBranchWithManagersRecord & {
  analytics: JsonRecord | null;
  userCount: number | null;
  inventoryValue: number | null;
  successfulSalesCount: number | null;
  requestCount: number | null;
};

export type AdminBranchNetworkResponse = AdminPageResponseMeta & {
  items: AdminBranchNetworkRecord[];
  summary: JsonRecord | null;
  raw: unknown;
};

export type AdminBranchUserRecord = {
  id: string;
  memberRole: string | null;
  assignedAt: string | null;
  endedAt: string | null;
  isPrimary: boolean;
  user: {
    id: string;
    email: string | null;
    role: string | null;
    status: string | null;
    displayName: string | null;
  };
  raw: JsonRecord;
};

export type AdminBranchDetailResponse = {
  branch: AdminBranchNetworkRecord | null;
  analytics: JsonRecord | null;
  users: AdminBranchUserRecord[];
  recentAuditLogs: AdminAuditLogRow[];
  raw: unknown;
};

export type AdminInventoryRequestUser = {
  id: string;
  email: string | null;
  role: string | null;
  status: string | null;
  raw: JsonRecord;
};

export type AdminInventoryRequestRecord = {
  id: string;
  status: string | null;
  fromLocation: string | null;
  branchId: string | null;
  productId: string | null;
  appointmentId: string | null;
  appointmentItemId: string | null;
  requestedByUserId: string | null;
  managerDecisionByUserId: string | null;
  mainDecisionByUserId: string | null;
  managerDecisionAt: string | null;
  mainDecisionAt: string | null;
  managerNote: string | null;
  mainNote: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  branch: {
    id: string;
    code: string | null;
    name: string | null;
    city: string | null;
    status: string | null;
  } | null;
  product: {
    id: string;
    sku: string | null;
    name: string | null;
    status: string | null;
    visibility: string | null;
  } | null;
  appointment: {
    id: string;
    appointmentDate: string | null;
    status: string | null;
    customerId: string | null;
    customerType: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  appointmentItem: {
    id: string;
    requestedSource: string | null;
    fulfillmentStatus: string | null;
    reservedAt: string | null;
  } | null;
  requestedByUser: AdminInventoryRequestUser | null;
  managerDecisionByUser: AdminInventoryRequestUser | null;
  mainDecisionByUser: AdminInventoryRequestUser | null;
  raw: JsonRecord;
};

export type AdminInventoryRequestsResponse = AdminPageResponseMeta & {
  filters: JsonRecord | null;
  items: AdminInventoryRequestRecord[];
  raw: unknown;
};

export type AdminCustomerListItem = {
  id: string;
  email: string | null;
  status: string | null;
  displayName: string | null;
  phone: string | null;
  customerTier: CustomerTier | null;
  raw: JsonRecord;
};

export type AdminCustomersResponse = AdminPageResponseMeta & {
  items: AdminCustomerListItem[];
  raw: unknown;
};

export type AdminProductMediaReference = {
  id: string | null;
  type: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  slot: MediaSlot | null;
  visibilitySections: MediaSection[];
  audience: MediaAudience | null;
  allowedRoles: MediaRole[];
  minCustomerTier: CustomerTier | null;
  targetUsers: Array<{
    userId: string;
  }>;
  visibilityPreset: MediaVisibilityPreset | null;
  raw: JsonRecord;
};

export type AdminProductBeneficiaryUser = {
  id: string;
  email: string | null;
  role: string | null;
  displayName: string | null;
  raw: JsonRecord;
};

export type AdminProductBeneficiaryBranch = {
  id: string;
  code: string | null;
  name: string | null;
  city: string | null;
  status: string | null;
  raw: JsonRecord;
};

export type AdminProductCommissionAllocation = {
  id: string;
  targetType: "BRANCH" | "USER" | string;
  beneficiaryUserId: string | null;
  beneficiaryBranchId: string | null;
  rate: number | null;
  note: string | null;
  beneficiaryUser: AdminProductBeneficiaryUser | null;
  beneficiaryBranch: AdminProductBeneficiaryBranch | null;
  raw: JsonRecord;
};

export type AdminProductRecord = {
  id: string;
  sku: string | null;
  name: string | null;
  color: string | null;
  origin: string | null;
  description: string | null;
  buyPrice: number | null;
  saleMinPrice: number | null;
  saleMaxPrice: number | null;
  weight: number | null;
  weightUnit: string | null;
  length: number | null;
  depth: number | null;
  height: number | null;
  importDate: string | null;
  importId: string | null;
  fromCompanyId: string | null;
  visibility: string | null;
  tier: string | null;
  status: string | null;
  minCustomerTier: CustomerTier | null;
  targetUserIds: string[];
  visibilityNote: string | null;
  sourceType: string | null;
  consignmentRate: number | null;
  consignmentAgreementId: string | null;
  consignmentContractMediaId: string | null;
  thumbnailImageId: string | null;
  featureVideoId: string | null;
  galleryImageIds: string[];
  certificateMediaIds: string[];
  media: AdminProductMediaReference[];
  commissionAllocations: AdminProductCommissionAllocation[];
  raw: JsonRecord;
};

export type AdminProductsResponse = AdminPageResponseMeta & {
  items: AdminProductRecord[];
  raw: unknown;
};

export type AdminInventoryProfitAnalytics = {
  includeSold: boolean;
  totals: {
    productCount: number;
    pricedProductCount: number;
    unpricedProductCount: number;
    projectedRevenueMin: number;
    projectedRevenueMax: number;
    projectedNetProfitMin: number;
    projectedNetProfitMax: number;
  };
  inventory: unknown[];
  raw: unknown;
};

export type MediaPageContext =
  | "PRODUCT_DETAIL"
  | "PRODUCT_LISTING"
  | "TOP_SHELF_PAGE"
  | "VIP_TARGETED_PAGE"
  | "PRIVATE_STAFF_VIEW";

const mediaSectionByPageContext: Record<MediaPageContext, MediaSection> = {
  PRODUCT_DETAIL: "PRODUCT_PAGE",
  PRODUCT_LISTING: "PRODUCT_PAGE",
  TOP_SHELF_PAGE: "TOP_SHELF",
  VIP_TARGETED_PAGE: "VIP",
  PRIVATE_STAFF_VIEW: "PRIVATE",
};

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
};

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asNullableString = (value: unknown) => {
  const normalized = asString(value);
  return normalized || null;
};

const asFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asFiniteNumberish = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asPositiveInt = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.floor(parsed);
};

const asNonNegativeInt = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
};

const normalizeCustomerTier = (value: unknown): CustomerTier | null => {
  const normalized = asString(value).toUpperCase();
  if (normalized === "REGULAR" || normalized === "VIP" || normalized === "ULTRA_VIP") {
    return normalized;
  }

  return null;
};

const normalizeAccountAccess = (value: unknown): AccountAccessState | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  return {
    code: asNullableString(row.code),
    blockedScope: asNullableString(row.blockedScope),
    canAuthenticate:
      typeof row.canAuthenticate === "boolean" ? row.canAuthenticate : null,
    canAccessRoleRoutes:
      typeof row.canAccessRoleRoutes === "boolean" ? row.canAccessRoleRoutes : null,
    remainingMs:
      asNonNegativeInt(row.remainingMs) ??
      asNonNegativeInt(row.remainingMilliseconds) ??
      asNonNegativeInt(row.remaining),
    raw: row,
  };
};

const ACCOUNT_ACCESS_DENIED_CODES = new Set([
  "ACCOUNT_BANNED",
  "ACCOUNT_RESTRICTED",
  "ACCOUNT_TERMINATED",
]);
const ADMIN_ACTION_RESTRICTED_CODE = "ADMIN_ACTION_RESTRICTED";
let accountDeniedRedirectInProgress = false;

const normalizeErrorCode = (value: unknown) => asString(value).toUpperCase();

const isAccountAccessDeniedCode = (value: unknown) =>
  ACCOUNT_ACCESS_DENIED_CODES.has(normalizeErrorCode(value));

export const redirectToBlockedPage = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== "/blocked") {
    window.location.replace("/blocked");
  }
};

export const forceLogoutToBlockedPage = async () => {
  if (typeof window === "undefined") {
    return;
  }

  if (accountDeniedRedirectInProgress) {
    return;
  }

  accountDeniedRedirectInProgress = true;

  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out failure and still redirect.
  }

  redirectToBlockedPage();
};

const buildErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  const message = typeof payload?.message === "string" ? payload.message : fallback;
  const code = typeof payload?.code === "string" ? payload.code : "";
  const reason = typeof payload?.reason === "string" ? payload.reason : "";

  if (code && reason) {
    return `${message} (code: ${code}, reason: ${reason})`;
  }

  if (code) {
    return `${message} (code: ${code})`;
  }

  if (reason) {
    return `${message} (reason: ${reason})`;
  }

  return message;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export const isAccountAccessDeniedError = (value: unknown): value is ApiClientError => {
  if (!(value instanceof ApiClientError)) {
    return false;
  }

  return value.status === 403 && isAccountAccessDeniedCode(value.code);
};

export const handleAccountAccessDeniedError = (value: unknown) => {
  if (!isAccountAccessDeniedError(value)) {
    return false;
  }

  return true;
};

export const isAdminActionRestrictedError = (
  value: unknown,
): value is ApiClientError => {
  if (!(value instanceof ApiClientError)) {
    return false;
  }

  return value.status === 403 && normalizeErrorCode(value.code) === ADMIN_ACTION_RESTRICTED_CODE;
};

const buildHeaders = ({
  accessToken,
  headers,
}: {
  accessToken?: string;
  headers?: HeadersInit;
}) => {
  const merged = new Headers(headers);

  if (accessToken) {
    merged.set("Authorization", `Bearer ${accessToken}`);
  }

  return merged;
};

type FetchJsonResponse = {
  status: number;
  payload: unknown;
};

const inFlightRequestMap = new Map<string, Promise<unknown>>();

const runWithInFlightDeduplication = <T>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> => {
  const existing = inFlightRequestMap.get(key) as Promise<T> | undefined;

  if (existing) {
    return existing;
  }

  const nextPromise = factory().finally(() => {
    if (inFlightRequestMap.get(key) === nextPromise) {
      inFlightRequestMap.delete(key);
    }
  });

  inFlightRequestMap.set(key, nextPromise as Promise<unknown>);

  return nextPromise;
};

const fetchJsonResponse = async ({
  path,
  method = "GET",
  accessToken,
  headers,
  body,
  fallbackErrorMessage,
}: {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  accessToken?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  fallbackErrorMessage: string;
}): Promise<FetchJsonResponse> => {
  const requestInit: RequestInit = {
    method,
    headers: buildHeaders({
      accessToken,
      headers,
    }),
    body,
    cache: "no-store",
  };

  const executeFetch = (targetPath: string) => fetch(targetPath, requestInit);
  const isRelativeApiPath = path.startsWith("/");
  const canTryDirectFallback =
    typeof window !== "undefined" &&
    isRelativeApiPath &&
    path.startsWith(`${API_BASE_PATH}/`) &&
    Boolean(PUBLIC_API_BASE_URL);

  let response = await executeFetch(path);

  if (response.status === 502 && canTryDirectFallback) {
    const directUrl = `${PUBLIC_API_BASE_URL}${path}`;

    try {
      const directResponse = await executeFetch(directUrl);

      if (directResponse.ok) {
        response = directResponse;
      } else if (directResponse.status < 500) {
        response = directResponse;
      }
    } catch {
      // Preserve the proxy response when direct fallback fails.
    }
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const errorPayload = asRecord(payload) as ApiErrorPayload | null;
    const responseMessage = buildErrorMessage(errorPayload, fallbackErrorMessage);
    const code = asNullableString(errorPayload?.code);
    const reason = asNullableString(errorPayload?.reason);

    throw new ApiClientError({
      message: `${responseMessage} [HTTP ${response.status}]`,
      status: response.status,
      code,
      reason,
      payload,
    });
  }

  return {
    status: response.status,
    payload,
  };
};

const fetchJson = async (
  options: Parameters<typeof fetchJsonResponse>[0],
) => {
  const response = await fetchJsonResponse(options);
  return response.payload;
};

const normalizeMediaSlot = (value: unknown): MediaSlot | null => {
  const normalized = asString(value).toUpperCase();

  if (
    normalized === "PUBLIC_THUMBNAIL" ||
    normalized === "PUBLIC_FEATURE_VIDEO" ||
    normalized === "PUBLIC_GALLERY" ||
    normalized === "PUBLIC_CERTIFICATE" ||
    normalized === "ROLE_REFERENCE" ||
    normalized === "CONSIGNMENT_CONTRACT"
  ) {
    return normalized;
  }

  return null;
};

const normalizeMediaRecord = (payload: unknown): MediaRecord | null => {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const candidate = asRecord(root.media) ?? root;

  const id = asString(candidate.id);
  const url = asString(candidate.url);
  const mimeType = asString(candidate.mimeType);
  const createdAt = asString(candidate.createdAt);
  const sizeBytes = asFiniteNumber(candidate.sizeBytes);

  if (!id || !url || !mimeType || !createdAt || sizeBytes === null) {
    return null;
  }

  const visibilitySections = Array.isArray(candidate.visibilitySections)
    ? candidate.visibilitySections
        .map((item) => asString(item).toUpperCase())
        .filter(
          (item): item is MediaSection =>
            item === "PRODUCT_PAGE" ||
            item === "TOP_SHELF" ||
            item === "VIP" ||
            item === "PRIVATE",
        )
    : [];

  const audience = asString(candidate.audience).toUpperCase();
  const allowedRoles = Array.isArray(candidate.allowedRoles)
    ? candidate.allowedRoles
        .map((role) => asString(role).toUpperCase())
        .filter((role): role is MediaRole => role === "ADMIN" || role === "MANAGER" || role === "SALES")
    : [];

  const targetUserIdsFromTargetUsers = Array.isArray(candidate.targetUsers)
    ? candidate.targetUsers
        .map((row) => asRecord(row))
        .map((row) => asString(row?.userId))
        .filter(Boolean)
    : [];
  const targetUserIdsFromFlatList = Array.isArray(candidate.targetUserIds)
    ? candidate.targetUserIds.map((entry) => asString(entry)).filter(Boolean)
    : [];
  const targetUserIds = [...new Set([...targetUserIdsFromTargetUsers, ...targetUserIdsFromFlatList])];

  const minCustomerTierRaw = asString(candidate.minCustomerTier).toUpperCase();
  const minCustomerTier =
    minCustomerTierRaw === "REGULAR" || minCustomerTierRaw === "VIP" || minCustomerTierRaw === "ULTRA_VIP"
      ? (minCustomerTierRaw as CustomerTier)
      : null;
  const visibilityPresetRaw = asString(candidate.visibilityPreset).toUpperCase().replace(/[\s-]+/g, "_");
  const visibilityPreset =
    visibilityPresetRaw === "PUBLIC" ||
    visibilityPresetRaw === "TOP_SHELF" ||
    visibilityPresetRaw === "USER_TIER" ||
    visibilityPresetRaw === "TARGETED_USER" ||
    visibilityPresetRaw === "PRIVATE" ||
    visibilityPresetRaw === "ADMIN" ||
    visibilityPresetRaw === "MANAGER" ||
    visibilityPresetRaw === "SALES"
      ? (visibilityPresetRaw as MediaVisibilityPreset)
      : null;

  return {
    id,
    productId:
      typeof candidate.productId === "string"
        ? candidate.productId
        : candidate.productId === null
          ? null
          : null,
    consignmentAgreementId: asNullableString(candidate.consignmentAgreementId),
    type: asString(candidate.type).toUpperCase(),
    mimeType,
    sizeBytes,
    url,
    createdAt,
    slot: normalizeMediaSlot(candidate.slot),
    visibilitySections,
    audience:
      audience === "PUBLIC" ||
      audience === "TARGETED" ||
      audience === "ADMIN_ONLY" ||
      audience === "ROLE_BASED" ||
      audience === "PRIVATE"
        ? (audience as MediaAudience)
        : null,
    allowedRoles,
    minCustomerTier,
    targetUserIds,
    visibilityPreset,
  };
};

const normalizeMediaUrlResponse = (
  payload: unknown,
): Pick<
  AdminMediaUrlResponse,
  | "id"
  | "productId"
  | "consignmentAgreementId"
  | "type"
  | "mimeType"
  | "sizeBytes"
  | "url"
  | "slot"
  | "visibilitySections"
  | "audience"
  | "allowedRoles"
  | "minCustomerTier"
  | "targetUsers"
  | "visibilityPreset"
> | null => {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const id = asString(root.id);
  const url = asString(root.url);

  if (!id || !url) {
    return null;
  }

  const visibilitySections = Array.isArray(root.visibilitySections)
    ? root.visibilitySections
        .map((item) => asString(item).toUpperCase())
        .filter(
          (item): item is MediaSection =>
            item === "PRODUCT_PAGE" || item === "TOP_SHELF" || item === "VIP" || item === "PRIVATE",
        )
    : [];
  const audienceRaw = asString(root.audience).toUpperCase();
  const audience =
    audienceRaw === "PUBLIC" ||
    audienceRaw === "TARGETED" ||
    audienceRaw === "ADMIN_ONLY" ||
    audienceRaw === "ROLE_BASED" ||
    audienceRaw === "PRIVATE"
      ? (audienceRaw as MediaAudience)
      : null;
  const allowedRoles = Array.isArray(root.allowedRoles)
    ? root.allowedRoles
        .map((role) => asString(role).toUpperCase())
        .filter((role): role is MediaRole => role === "ADMIN" || role === "MANAGER" || role === "SALES")
    : [];
  const minCustomerTierRaw = asString(root.minCustomerTier).toUpperCase();
  const minCustomerTier =
    minCustomerTierRaw === "REGULAR" || minCustomerTierRaw === "VIP" || minCustomerTierRaw === "ULTRA_VIP"
      ? (minCustomerTierRaw as CustomerTier)
      : null;
  const targetUsers = Array.isArray(root.targetUsers)
    ? root.targetUsers
        .map((row) => asRecord(row))
        .map((row) => ({ userId: asString(row?.userId) }))
        .filter((row) => Boolean(row.userId))
    : [];
  const visibilityPresetRaw = asString(root.visibilityPreset).toUpperCase().replace(/[\s-]+/g, "_");
  const visibilityPreset =
    visibilityPresetRaw === "PUBLIC" ||
    visibilityPresetRaw === "TOP_SHELF" ||
    visibilityPresetRaw === "USER_TIER" ||
    visibilityPresetRaw === "TARGETED_USER" ||
    visibilityPresetRaw === "PRIVATE" ||
    visibilityPresetRaw === "ADMIN" ||
    visibilityPresetRaw === "MANAGER" ||
    visibilityPresetRaw === "SALES"
      ? (visibilityPresetRaw as MediaVisibilityPreset)
      : null;

  return {
    id,
    productId: asNullableString(root.productId),
    consignmentAgreementId: asNullableString(root.consignmentAgreementId),
    url,
    type: asNullableString(root.type),
    mimeType: asNullableString(root.mimeType),
    sizeBytes: asFiniteNumber(root.sizeBytes),
    slot: normalizeMediaSlot(root.slot),
    visibilitySections,
    audience,
    allowedRoles,
    minCustomerTier,
    targetUsers,
    visibilityPreset,
  };
};

const normalizeAuditRow = (rawRow: unknown): AdminAuditLogRow | null => {
  const row = asRecord(rawRow);
  if (!row) {
    return null;
  }

  const id = asString(row.id) || asString(row.logId);
  const action = asString(row.action) || asString(row.event) || asString(row.type);

  if (!id || !action) {
    return null;
  }

  const actorUser = asRecord(row.actorUser);
  const metadata = row.metadata ?? row.details ?? null;
  const metadataRecord = asRecord(metadata);
  const metadataMessage =
    asNullableString(metadataRecord?.message) ||
    asNullableString(metadataRecord?.reason) ||
    asNullableString(metadataRecord?.note);

  return {
    id,
    action,
    actorId:
      asNullableString(row.actorUserId) ||
      asNullableString(row.actorId) ||
      asNullableString(row.userId) ||
      asNullableString(actorUser?.id),
    actorEmail:
      asNullableString(row.actorEmail) ||
      asNullableString(row.userEmail) ||
      asNullableString(actorUser?.email),
    targetType:
      asNullableString(row.entityType) ||
      asNullableString(row.targetType) ||
      asNullableString(row.resourceType),
    targetId:
      asNullableString(row.entityId) ||
      asNullableString(row.targetId) ||
      asNullableString(row.resourceId),
    message: asNullableString(row.message) || metadataMessage,
    details: metadata,
    createdAt: asNullableString(row.createdAt) || asNullableString(row.timestamp),
    ipAddress: asNullableString(row.ipAddress) || asNullableString(row.ip),
    userAgent: asNullableString(row.userAgent),
    raw: row,
  };
};

const normalizeInternalErrorRow = (rawRow: unknown): AdminInternalErrorLogRow | null => {
  const row = asRecord(rawRow);
  if (!row) {
    return null;
  }

  const id = asString(row.id) || asString(row.logId);
  if (!id) {
    return null;
  }

  const actorUser = asRecord(row.actorUser);

  return {
    id,
    actorUserId: asNullableString(row.actorUserId) || asNullableString(actorUser?.id),
    actorEmail: asNullableString(row.actorEmail) || asNullableString(actorUser?.email),
    actorRole: asNullableString(row.actorRole) || asNullableString(actorUser?.role),
    source: asNullableString(row.source),
    process: asNullableString(row.process),
    functionName: asNullableString(row.functionName),
    message: asNullableString(row.message),
    stack: asNullableString(row.stack),
    colorCode: asNullableString(row.colorCode),
    requestId: asNullableString(row.requestId),
    ipAddress: asNullableString(row.ipAddress) || asNullableString(row.ip),
    userAgent: asNullableString(row.userAgent),
    metadata: row.metadata ?? row.details ?? null,
    createdAt: asNullableString(row.createdAt) || asNullableString(row.timestamp),
    raw: row,
  };
};

const normalizeAuditPagination = ({
  payload,
  rowCount,
}: {
  payload: JsonRecord;
  rowCount: number;
}) => {
  const pagination = asRecord(payload.pagination);

  const page =
    asPositiveInt(pagination?.page) ??
    asPositiveInt(payload.page) ??
    asPositiveInt(payload.currentPage) ??
    1;
  const limit =
    asPositiveInt(pagination?.limit) ??
    asPositiveInt(payload.limit) ??
    asPositiveInt(payload.pageSize) ??
    Math.max(1, rowCount || 25);

  const total =
    asPositiveInt(pagination?.total) ??
    asPositiveInt(payload.total) ??
    asPositiveInt(payload.totalCount) ??
    rowCount;

  const fallbackTotalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const totalPages =
    asPositiveInt(pagination?.totalPages) ??
    asPositiveInt(payload.totalPages) ??
    fallbackTotalPages;

  return {
    page,
    limit,
    total,
    totalPages,
  };
};

const extractAuditRows = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  if (Array.isArray(root.records)) {
    return root.records;
  }

  if (Array.isArray(root.items)) {
    return root.items;
  }

  if (Array.isArray(root.logs)) {
    return root.logs;
  }

  if (Array.isArray(root.data)) {
    return root.data;
  }

  return [];
};

const extractInternalErrorRows = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  if (Array.isArray(root.records)) {
    return root.records;
  }

  if (Array.isArray(root.items)) {
    return root.items;
  }

  if (Array.isArray(root.logs)) {
    return root.logs;
  }

  if (Array.isArray(root.data)) {
    return root.data;
  }

  return [];
};

const extractBackupRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  if (Array.isArray(root.files)) {
    return root.files;
  }

  if (Array.isArray(root.backups)) {
    return root.backups;
  }

  if (Array.isArray(root.data)) {
    return root.data;
  }

  return [];
};

const normalizeLogHistoryType = (value: unknown): LogHistoryType => {
  const normalized = asString(value).toLowerCase();
  if (
    normalized === "all" ||
    normalized === "internal" ||
    normalized === "audit" ||
    normalized === "product" ||
    normalized === "other"
  ) {
    return normalized;
  }

  return "all";
};

const extractLogHistoryRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  if (Array.isArray(root.items)) {
    return root.items;
  }

  if (Array.isArray(root.files)) {
    return root.files;
  }

  if (Array.isArray(root.data)) {
    return root.data;
  }

  return [];
};

const extractPaginatedRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  if (Array.isArray(root.records)) {
    return root.records;
  }

  if (Array.isArray(root.items)) {
    return root.items;
  }

  if (Array.isArray(root.data)) {
    return root.data;
  }

  if (Array.isArray(root.users)) {
    return root.users;
  }

  if (Array.isArray(root.branches)) {
    return root.branches;
  }

  if (Array.isArray(root.products)) {
    return root.products;
  }

  if (Array.isArray(root.customers)) {
    return root.customers;
  }

  return [];
};

const resolveProfileField = (user: JsonRecord, fieldName: "displayName" | "phone" | "lineId") => {
  const profileCandidates = [
    asRecord(user.adminProfile),
    asRecord(user.managerProfile),
    asRecord(user.salespersonProfile),
    asRecord(user.customerProfile),
  ];

  for (const profile of profileCandidates) {
    const value = asNullableString(profile?.[fieldName]);
    if (value) {
      return value;
    }
  }

  return asNullableString(user[fieldName]);
};

const normalizeAdminUserReference = (value: unknown): AdminInventoryRequestUser | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    email: asNullableString(row.email),
    role: asNullableString(row.role),
    status: asNullableString(row.status),
    raw: row,
  };
};

const normalizeAdminUserRow = (value: unknown): AdminUserListItem | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const customerProfile = asRecord(row.customerProfile);
  const branchMemberships = Array.isArray(row.branchMemberships)
    ? row.branchMemberships
        .map((membership) => asRecord(membership))
        .map((membership) => {
          const membershipId = asString(membership?.id);
          const branchId = asString(membership?.branchId);
          if (!membershipId || !branchId) {
            return null;
          }

          const branch = asRecord(membership?.branch);
          return {
            id: membershipId,
            branchId,
            memberRole: asNullableString(membership?.memberRole),
            isPrimary: membership?.isPrimary === true,
            assignedAt: asNullableString(membership?.assignedAt),
            endedAt: asNullableString(membership?.endedAt),
            branch: branch
              ? {
                  id: asString(branch.id) || branchId,
                  code: asNullableString(branch.code),
                  name: asNullableString(branch.name),
                  status: asNullableString(branch.status),
                }
              : null,
          } satisfies AdminUserBranchMembership;
        })
        .filter((membership): membership is AdminUserBranchMembership => Boolean(membership))
    : [];

  return {
    id,
    supabaseUserId: asNullableString(row.supabaseUserId),
    email: asNullableString(row.email),
    role: asNullableString(row.role),
    status: asNullableString(row.status),
    isMainAdmin: row.isMainAdmin === true,
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    deactivatedAt: asNullableString(row.deactivatedAt),
    terminatedAt: asNullableString(row.terminatedAt),
    displayName: resolveProfileField(row, "displayName"),
    phone: resolveProfileField(row, "phone"),
    lineId: resolveProfileField(row, "lineId"),
    customerTier: normalizeCustomerTier(customerProfile?.tier),
    branchMemberships,
    raw: row,
  };
};

const normalizeAdminUserEntityReference = (value: unknown): AdminUserReference | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    email: asNullableString(row.email),
    role: asNullableString(row.role),
    status: asNullableString(row.status),
    isMainAdmin: row.isMainAdmin === true,
    raw: row,
  };
};

const normalizeAdminAccessRestriction = (value: unknown): AdminUserAccessRestriction | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  const userId = asString(row.userId);
  if (!id || !userId) {
    return null;
  }

  return {
    id,
    userId,
    type: asString(row.type).toUpperCase() || "",
    reason: asNullableString(row.reason),
    note: asNullableString(row.note),
    startsAt: asNullableString(row.startsAt),
    endsAt: asNullableString(row.endsAt),
    isActive: row.isActive === true,
    liftedAt: asNullableString(row.liftedAt),
    statusBeforeAction: asNullableString(row.statusBeforeAction),
    statusRestoredAt: asNullableString(row.statusRestoredAt),
    roleDowngradedFrom: asNullableString(row.roleDowngradedFrom),
    roleRestoredAt: asNullableString(row.roleRestoredAt),
    metadata: row.metadata ?? null,
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    createdByUserId: asNullableString(row.createdByUserId),
    updatedByUserId: asNullableString(row.updatedByUserId),
    createdByUser: normalizeAdminUserEntityReference(row.createdByUser),
    updatedByUser: normalizeAdminUserEntityReference(row.updatedByUser),
    raw: row,
  };
};

const normalizeAdminApprovalRequest = (value: unknown): AdminApprovalRequest | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  const targetUserId = asString(row.targetUserId);
  if (!id || !targetUserId) {
    return null;
  }

  return {
    id,
    actionType: asString(row.actionType).toUpperCase() || "",
    status: asString(row.status).toUpperCase() || "",
    targetUserId,
    requestedByUserId: asNullableString(row.requestedByUserId),
    reviewedByUserId: asNullableString(row.reviewedByUserId),
    requestReason: asNullableString(row.requestReason),
    decisionNote: asNullableString(row.decisionNote),
    requestPayload: row.requestPayload ?? null,
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    decidedAt: asNullableString(row.decidedAt),
    targetUser: normalizeAdminUserEntityReference(row.targetUser),
    requestedByUser: normalizeAdminUserEntityReference(row.requestedByUser),
    reviewedByUser: normalizeAdminUserEntityReference(row.reviewedByUser),
    raw: row,
  };
};

const normalizeAdminUserDetail = (value: unknown): AdminUserDetail | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const branchMemberships = Array.isArray(row.branchMemberships)
    ? row.branchMemberships
        .map((membership) => asRecord(membership))
        .map((membership) => {
          const membershipId = asString(membership?.id);
          const branchId = asString(membership?.branchId);
          if (!membershipId || !branchId) {
            return null;
          }

          const branch = asRecord(membership?.branch);
          return {
            id: membershipId,
            branchId,
            memberRole: asNullableString(membership?.memberRole),
            isPrimary: membership?.isPrimary === true,
            assignedAt: asNullableString(membership?.assignedAt),
            endedAt: asNullableString(membership?.endedAt),
            branch: branch
              ? {
                  id: asString(branch.id) || branchId,
                  code: asNullableString(branch.code),
                  name: asNullableString(branch.name),
                  status: asNullableString(branch.status),
                }
              : null,
          } satisfies AdminUserBranchMembership;
        })
        .filter((membership): membership is AdminUserBranchMembership => Boolean(membership))
    : [];

  const accessRestrictions = Array.isArray(row.accessRestrictions)
    ? row.accessRestrictions
        .map((entry) => normalizeAdminAccessRestriction(entry))
        .filter((entry): entry is AdminUserAccessRestriction => Boolean(entry))
    : [];
  const activeAccessControls = Array.isArray(row.activeAccessControls)
    ? row.activeAccessControls
        .map((entry) => normalizeAdminAccessRestriction(entry))
        .filter((entry): entry is AdminUserAccessRestriction => Boolean(entry))
    : [];
  const approvalRequestsSubmitted = Array.isArray(row.approvalRequestsSubmitted)
    ? row.approvalRequestsSubmitted
        .map((entry) => normalizeAdminApprovalRequest(entry))
        .filter((entry): entry is AdminApprovalRequest => Boolean(entry))
    : [];
  const approvalRequestsTargeted = Array.isArray(row.approvalRequestsTargeted)
    ? row.approvalRequestsTargeted
        .map((entry) => normalizeAdminApprovalRequest(entry))
        .filter((entry): entry is AdminApprovalRequest => Boolean(entry))
    : [];

  return {
    id,
    supabaseUserId: asNullableString(row.supabaseUserId),
    email: asNullableString(row.email),
    role: asNullableString(row.role),
    status: asNullableString(row.status),
    isMainAdmin: row.isMainAdmin === true,
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    deactivatedAt: asNullableString(row.deactivatedAt),
    terminatedAt: asNullableString(row.terminatedAt),
    adminProfile: asRecord(row.adminProfile),
    managerProfile: asRecord(row.managerProfile),
    salespersonProfile: asRecord(row.salespersonProfile),
    customerProfile: asRecord(row.customerProfile),
    branchMemberships,
    accessRestrictions,
    activeAccessControlsCount: asPositiveInt(row.activeAccessControlsCount) ?? activeAccessControls.length,
    activeAccessControls,
    approvalRequestsSubmitted,
    approvalRequestsTargeted,
    raw: row,
  };
};

const normalizeAdminActionResponse = (
  statusCode: number,
  payload: unknown,
  responseStatus?: number,
): AdminActionResponse => {
  const root = asRecord(payload) ?? {};
  const code = asNullableString(root.code);
  const approvalRequest = normalizeAdminApprovalRequest(root.approvalRequest);
  const request = normalizeAdminApprovalRequest(root.request);
  const inferredStatusCode =
    responseStatus ??
    asPositiveInt(root.statusCode) ??
    asPositiveInt(root.httpStatus) ??
    ((approvalRequest || request || code === "APPROVAL_REQUEST_SUBMITTED") ? 202 : statusCode);

  return {
    statusCode: inferredStatusCode,
    message: asNullableString(root.message),
    code,
    approvalRequest,
    request,
    executionResult: root.executionResult ?? null,
    data: asRecord(payload),
    raw: payload,
  };
};

const normalizeAdminCustomerRow = (value: unknown): AdminCustomerListItem | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const customerProfile = asRecord(row.customerProfile);

  return {
    id,
    email: asNullableString(row.email),
    status: asNullableString(row.status),
    displayName: resolveProfileField(row, "displayName"),
    phone: resolveProfileField(row, "phone"),
    customerTier:
      normalizeCustomerTier(customerProfile?.tier) ??
      normalizeCustomerTier(row.customerTier),
    raw: row,
  };
};

const normalizeAdminBranchManager = (value: unknown): AdminBranchManager | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    email: asNullableString(row.email),
    role: asNullableString(row.role),
    status: asNullableString(row.status),
    displayName: resolveProfileField(row, "displayName"),
    phone: resolveProfileField(row, "phone"),
    lineId: resolveProfileField(row, "lineId"),
    membershipId: asNullableString(row.membershipId),
    isPrimaryMembership: row.isPrimaryMembership === true || row.isPrimary === true,
    assignedAt: asNullableString(row.assignedAt),
    raw: row,
  };
};

const normalizeAdminBranchRow = (value: unknown): AdminBranchWithManagersRecord | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const managers = Array.isArray(row.managers)
    ? row.managers
        .map((entry) => normalizeAdminBranchManager(entry))
        .filter((entry): entry is AdminBranchManager => Boolean(entry))
    : [];
  const primaryManager = normalizeAdminBranchManager(row.primaryManager);

  return {
    id,
    code: asNullableString(row.code),
    name: asNullableString(row.name),
    city: asNullableString(row.city),
    address: asNullableString(row.address),
    status: asNullableString(row.status),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    primaryManagerUserId: asNullableString(row.primaryManagerUserId),
    primaryManager,
    managerCount: asPositiveInt(row.managerCount) ?? managers.length,
    managers,
    raw: row,
  };
};

const normalizeAdminBranchNetworkRow = (value: unknown): AdminBranchNetworkRecord | null => {
  const base =
    normalizeAdminBranchRow(value) ??
    normalizeAdminBranchRow(asRecord(value)?.branch) ??
    null;
  const row = asRecord(value);

  if (!base || !row) {
    return null;
  }

  const analytics = asRecord(row.analytics) ?? asRecord(asRecord(row.branch)?.analytics);

  return {
    ...base,
    analytics,
    userCount:
      asNonNegativeInt(row.userCount) ??
      asNonNegativeInt(analytics?.userCount) ??
      asNonNegativeInt(analytics?.users),
    inventoryValue:
      asFiniteNumber(row.inventoryValue) ??
      asFiniteNumber(analytics?.inventoryValue) ??
      asFiniteNumber(analytics?.inventoryValueAmount),
    successfulSalesCount:
      asNonNegativeInt(row.successfulSalesCount) ??
      asNonNegativeInt(row.successfulSales) ??
      asNonNegativeInt(analytics?.successfulSalesCount) ??
      asNonNegativeInt(analytics?.successfulSales),
    requestCount:
      asNonNegativeInt(row.requestCount) ??
      asNonNegativeInt(analytics?.requestCount) ??
      asNonNegativeInt(analytics?.requests),
  };
};

const resolveBranchUserDisplayName = (user: JsonRecord | null) =>
  resolveProfileField(user ?? {}, "displayName") || asNullableString(user?.email);

const normalizeAdminBranchUserRow = (value: unknown): AdminBranchUserRecord | null => {
  const row = asRecord(value);
  const user = asRecord(row?.user);
  const userId = asString(user?.id);

  if (!row || !userId) {
    return null;
  }

  const id =
    asString(row.id) ||
    `${userId}:${asString(row.memberRole) || asString(user?.role) || "MEMBER"}`;

  return {
    id,
    memberRole: asNullableString(row.memberRole) || asNullableString(user?.role),
    assignedAt: asNullableString(row.assignedAt),
    endedAt: asNullableString(row.endedAt),
    isPrimary: row.isPrimary === true,
    user: {
      id: userId,
      email: asNullableString(user?.email),
      role: asNullableString(user?.role),
      status: asNullableString(user?.status),
      displayName: resolveBranchUserDisplayName(user) || userId,
    },
    raw: row,
  };
};

const normalizeAdminProductBeneficiaryUser = (
  value: unknown,
): AdminProductBeneficiaryUser | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    email: asNullableString(row.email),
    role: asNullableString(row.role),
    displayName: resolveProfileField(row, "displayName"),
    raw: row,
  };
};

const normalizeAdminProductBeneficiaryBranch = (
  value: unknown,
): AdminProductBeneficiaryBranch | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    code: asNullableString(row.code),
    name: asNullableString(row.name),
    city: asNullableString(row.city),
    status: asNullableString(row.status),
    raw: row,
  };
};

const normalizeAdminProductMediaReference = (
  value: unknown,
): AdminProductMediaReference | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const normalized = normalizeMediaUrlResponse(row);
  const mediaId = asNullableString(row.id);
  const mediaUrl = asNullableString(row.url);

  if (!normalized && !mediaId && !mediaUrl) {
    return null;
  }

  return {
    id: normalized?.id ?? mediaId,
    type: normalized?.type ?? asNullableString(row.type),
    url: normalized?.url ?? mediaUrl,
    mimeType: normalized?.mimeType ?? asNullableString(row.mimeType),
    sizeBytes: normalized?.sizeBytes ?? asFiniteNumberish(row.sizeBytes),
    slot: normalized?.slot ?? normalizeMediaSlot(row.slot),
    visibilitySections: normalized?.visibilitySections ?? [],
    audience: normalized?.audience ?? null,
    allowedRoles: normalized?.allowedRoles ?? [],
    minCustomerTier: normalized?.minCustomerTier ?? null,
    targetUsers: normalized?.targetUsers ?? [],
    visibilityPreset: normalized?.visibilityPreset ?? null,
    raw: row,
  };
};

const normalizeAdminProductCommissionAllocation = (
  value: unknown,
): AdminProductCommissionAllocation | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    targetType: asString(row.targetType).toUpperCase() || "USER",
    beneficiaryUserId:
      asNullableString(row.beneficiaryUserId) ??
      asNullableString(row.userId),
    beneficiaryBranchId:
      asNullableString(row.beneficiaryBranchId) ??
      asNullableString(row.branchId),
    rate: asFiniteNumberish(row.rate),
    note: asNullableString(row.note),
    beneficiaryUser: normalizeAdminProductBeneficiaryUser(row.beneficiaryUser),
    beneficiaryBranch: normalizeAdminProductBeneficiaryBranch(row.beneficiaryBranch),
    raw: row,
  };
};

const normalizeAdminProductRow = (value: unknown): AdminProductRecord | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const publicMedia = asRecord(row.publicMedia);
  const certificateMediaId =
    asNullableString(publicMedia?.certificateMediaId) ||
    asNullableString(row.certificateMediaId);

  const directTargetUserIds = Array.isArray(row.targetUserIds)
    ? row.targetUserIds.map((entry) => asString(entry)).filter(Boolean)
    : [];
  const nestedTargetUserIds = Array.isArray(row.targetUsers)
    ? row.targetUsers
        .map((entry) => asRecord(entry))
        .map((entry) => asString(entry?.userId))
        .filter(Boolean)
    : [];
  const media = Array.isArray(row.media)
    ? row.media
        .map((entry) => normalizeAdminProductMediaReference(entry))
        .filter((entry): entry is AdminProductMediaReference => Boolean(entry))
    : [];
  const commissionAllocations = Array.isArray(row.commissionAllocations)
    ? row.commissionAllocations
        .map((entry) => normalizeAdminProductCommissionAllocation(entry))
        .filter((entry): entry is AdminProductCommissionAllocation => Boolean(entry))
    : [];

  return {
    id,
    sku: asNullableString(row.sku),
    name: asNullableString(row.name),
    color: asNullableString(row.color),
    origin: asNullableString(row.origin),
    description: asNullableString(row.description),
    buyPrice: asFiniteNumberish(row.buyPrice),
    saleMinPrice: asFiniteNumberish(row.saleMinPrice),
    saleMaxPrice: asFiniteNumberish(row.saleMaxPrice),
    weight: asFiniteNumberish(row.weight),
    weightUnit: asNullableString(row.weightUnit),
    length: asFiniteNumberish(row.length),
    depth: asFiniteNumberish(row.depth),
    height: asFiniteNumberish(row.height),
    importDate: asNullableString(row.importDate),
    importId: asNullableString(row.importId),
    fromCompanyId: asNullableString(row.fromCompanyId),
    visibility: asNullableString(row.visibility),
    tier: asNullableString(row.tier),
    status: asNullableString(row.status),
    minCustomerTier: normalizeCustomerTier(row.minCustomerTier),
    targetUserIds: [...new Set([...directTargetUserIds, ...nestedTargetUserIds])],
    visibilityNote: asNullableString(row.visibilityNote),
    sourceType: asNullableString(row.sourceType),
    consignmentRate: asFiniteNumberish(row.consignmentRate),
    consignmentAgreementId: asNullableString(row.consignmentAgreementId),
    consignmentContractMediaId: asNullableString(row.consignmentContractMediaId),
    thumbnailImageId:
      asNullableString(publicMedia?.thumbnailMediaId) ??
      asNullableString(row.thumbnailImageId),
    featureVideoId:
      asNullableString(publicMedia?.featureVideoMediaId) ??
      asNullableString(row.featureVideoId),
    galleryImageIds: normalizeIdList(
      Array.isArray(publicMedia?.galleryMediaIds)
        ? publicMedia?.galleryMediaIds
        : Array.isArray(row.galleryImageIds)
          ? row.galleryImageIds
          : [],
    ),
    certificateMediaIds: normalizeIdList(
      Array.isArray(row.certificateMediaIds)
        ? row.certificateMediaIds
        : certificateMediaId
          ? [certificateMediaId]
          : [],
    ),
    media,
    commissionAllocations,
    raw: row,
  };
};

const normalizeInventoryRequestRow = (value: unknown): AdminInventoryRequestRecord | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const branch = asRecord(row.branch);
  const product = asRecord(row.product);
  const appointment = asRecord(row.appointment);
  const appointmentItem = asRecord(row.appointmentItem);

  return {
    id,
    status: asNullableString(row.status),
    fromLocation: asNullableString(row.fromLocation),
    branchId: asNullableString(row.branchId),
    productId: asNullableString(row.productId),
    appointmentId: asNullableString(row.appointmentId),
    appointmentItemId: asNullableString(row.appointmentItemId),
    requestedByUserId: asNullableString(row.requestedByUserId),
    managerDecisionByUserId: asNullableString(row.managerDecisionByUserId),
    mainDecisionByUserId: asNullableString(row.mainDecisionByUserId),
    managerDecisionAt: asNullableString(row.managerDecisionAt),
    mainDecisionAt: asNullableString(row.mainDecisionAt),
    managerNote: asNullableString(row.managerNote),
    mainNote: asNullableString(row.mainNote),
    rejectionReason: asNullableString(row.rejectionReason),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    branch: branch
      ? {
          id: asString(branch.id),
          code: asNullableString(branch.code),
          name: asNullableString(branch.name),
          city: asNullableString(branch.city),
          status: asNullableString(branch.status),
        }
      : null,
    product: product
      ? {
          id: asString(product.id),
          sku: asNullableString(product.sku),
          name: asNullableString(product.name),
          status: asNullableString(product.status),
          visibility: asNullableString(product.visibility),
        }
      : null,
    appointment: appointment
      ? {
          id: asString(appointment.id),
          appointmentDate: asNullableString(appointment.appointmentDate),
          status: asNullableString(appointment.status),
          customerId: asNullableString(appointment.customerId),
          customerType: asNullableString(appointment.customerType),
          name: asNullableString(appointment.name),
          email: asNullableString(appointment.email),
          phone: asNullableString(appointment.phone),
        }
      : null,
    appointmentItem: appointmentItem
      ? {
          id: asString(appointmentItem.id),
          requestedSource: asNullableString(appointmentItem.requestedSource),
          fulfillmentStatus: asNullableString(appointmentItem.fulfillmentStatus),
          reservedAt: asNullableString(appointmentItem.reservedAt),
        }
      : null,
    requestedByUser: normalizeAdminUserReference(row.requestedByUser),
    managerDecisionByUser: normalizeAdminUserReference(row.managerDecisionByUser),
    mainDecisionByUser: normalizeAdminUserReference(row.mainDecisionByUser),
    raw: row,
  };
};

const setCsvQuery = (search: URLSearchParams, key: string, value?: string | string[]) => {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => asString(entry))
      .filter(Boolean);
    if (normalized.length) {
      search.set(key, normalized.join(","));
    }
    return;
  }

  const normalized = asString(value);
  if (normalized) {
    search.set(key, normalized);
  }
};

export const mapPageContextToMediaSection = (context: MediaPageContext): MediaSection =>
  mediaSectionByPageContext[context];

export const createMediaPresign = async ({
  accessToken,
  fileName,
  contentType,
  sizeBytes,
  productId,
  consignmentAgreementId,
}: {
  accessToken: string;
  fileName: string;
  contentType: string;
  sizeBytes?: number;
  productId?: string;
  consignmentAgreementId?: string;
}): Promise<MediaPresignResponse> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/media/presign`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName,
      contentType,
      ...(typeof sizeBytes === "number" ? { sizeBytes } : {}),
      ...(productId ? { productId } : {}),
      ...(consignmentAgreementId ? { consignmentAgreementId } : {}),
    }),
    fallbackErrorMessage: "Failed to request media upload URL.",
  });

  const root = asRecord(payload);
  const upload = asRecord(root?.upload) ?? asRecord(root?.uploadTarget);
  const uploadUrl =
    asString(root?.uploadUrl) ||
    asString(root?.presignedUrl) ||
    asString(upload?.url) ||
    asString(root?.url);
  const key =
    asString(root?.key) ||
    asString(root?.storageKey) ||
    asString(root?.objectKey) ||
    asString(root?.path);
  const uploadHeadersRecord = asRecord(root?.uploadHeaders) ?? asRecord(root?.headers) ?? asRecord(upload?.headers);
  const uploadHeaders: Record<string, string> = {};

  for (const [headerName, headerValue] of Object.entries(uploadHeadersRecord ?? {})) {
    if (typeof headerValue === "string" && headerValue.trim()) {
      uploadHeaders[headerName] = headerValue;
    }
  }

  if (!uploadUrl || !key) {
    throw new ApiClientError({
      message: "Invalid media presign response.",
      status: 500,
      payload,
    });
  }

  return {
    uploadUrl,
    key,
    url:
      asNullableString(root?.storageUrl) ||
      asNullableString(root?.fileUrl) ||
      asNullableString(root?.publicUrl),
    expiresAt: asNullableString(root?.expiresAt) || asNullableString(upload?.expiresAt),
    uploadMethod: asString(root?.uploadMethod) || asString(upload?.method) || "PUT",
    uploadHeaders,
    productId: asNullableString(root?.productId),
    consignmentAgreementId: asNullableString(root?.consignmentAgreementId),
  };
};

export const uploadFileToPresignedUrl = async ({
  uploadUrl,
  file,
  contentType,
  method = "PUT",
  headers,
}: {
  uploadUrl: string;
  file: File;
  contentType: string;
  method?: string;
  headers?: Record<string, string>;
}) => {
  const mergedHeaders: Record<string, string> = {
    ...(headers ?? {}),
  };

  if (!Object.keys(mergedHeaders).some((headerName) => headerName.toLowerCase() === "content-type")) {
    mergedHeaders["Content-Type"] = contentType;
  }

  const response = await fetch(uploadUrl, {
    method,
    headers: mergedHeaders,
    body: file,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiClientError({
      message: `Failed to upload file to storage (status ${response.status}).`,
      status: response.status,
    });
  }
};

export const createMediaRecord = async ({
  accessToken,
  key,
  mimeType,
  sizeBytes,
  productId,
  consignmentAgreementId,
  slot,
  displayOrder,
  visibilitySections,
  audience,
  visibilityPreset,
  allowedRoles,
  minCustomerTier,
  targetUserIds,
}: {
  accessToken: string;
  key?: string;
  mimeType?: string;
  sizeBytes?: number;
  productId?: string;
  consignmentAgreementId?: string;
  slot?: MediaSlot | string;
  displayOrder?: number;
  visibilitySections?: MediaSection[];
  audience?: MediaAudience;
  visibilityPreset?: MediaVisibilityPreset;
  allowedRoles?: MediaRole[];
  minCustomerTier?: CustomerTier;
  targetUserIds?: string[];
}): Promise<MediaRecord> => {
  const normalizedKey = asString(key);
  const normalizedSlot =
    normalizeMediaSlot(slot) ||
    (consignmentAgreementId ? "CONSIGNMENT_CONTRACT" : null);
  const normalizedPreset = visibilityPreset ?? null;
  const normalizedAudience =
    audience ??
    (normalizedPreset === "PUBLIC" || normalizedPreset === "TOP_SHELF"
      ? "PUBLIC"
      : normalizedPreset === "USER_TIER" || normalizedPreset === "TARGETED_USER"
        ? "TARGETED"
        : normalizedPreset === "PRIVATE"
          ? "PRIVATE"
          : normalizedPreset === "ADMIN"
            ? "ADMIN_ONLY"
            : normalizedPreset === "MANAGER" || normalizedPreset === "SALES"
              ? "ROLE_BASED"
              : null);
  const normalizedAllowedRoles =
    allowedRoles && allowedRoles.length > 0
      ? [...new Set(allowedRoles.map((role) => asString(role).toUpperCase()).filter(Boolean))]
      : normalizedPreset === "ADMIN"
        ? ["ADMIN"]
        : normalizedPreset === "MANAGER"
          ? ["MANAGER"]
          : normalizedPreset === "SALES"
            ? ["SALES"]
            : [];
  const normalizedSections =
    visibilitySections && visibilitySections.length > 0
      ? [...new Set(visibilitySections.map((section) => asString(section).toUpperCase()).filter(Boolean))]
      : normalizedPreset === "TOP_SHELF"
        ? ["PRODUCT_PAGE", "TOP_SHELF"]
        : normalizedPreset === "PUBLIC"
          ? ["PRODUCT_PAGE"]
          : normalizedPreset === "PRIVATE"
            ? ["PRIVATE"]
            : [];
  const normalizedTargetUserIds = normalizeIdList(targetUserIds);

  if (!normalizedKey || !mimeType) {
    throw new ApiClientError({
      message: "Invalid media create payload.",
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/media`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: normalizedKey,
      mimeType,
      ...(typeof sizeBytes === "number" ? { sizeBytes } : {}),
      ...(productId ? { productId } : {}),
      ...(consignmentAgreementId ? { consignmentAgreementId } : {}),
      ...(normalizedSlot ? { slot: normalizedSlot } : {}),
      ...(typeof displayOrder === "number" ? { displayOrder } : {}),
      ...(normalizedSections.length ? { visibilitySections: normalizedSections } : {}),
      ...(normalizedAudience ? { audience: normalizedAudience } : {}),
      ...(normalizedAllowedRoles.length ? { allowedRoles: normalizedAllowedRoles } : {}),
      ...(minCustomerTier ? { minCustomerTier } : {}),
      ...(normalizedTargetUserIds.length ? { targetUserIds: normalizedTargetUserIds } : {}),
    }),
    fallbackErrorMessage: "Failed to create media record.",
  });

  const media = normalizeMediaRecord(payload);

  if (!media) {
    throw new ApiClientError({
      message: "Invalid media record response.",
      status: 500,
      payload,
    });
  }

  return media;
};

export const getPublicMediaUrl = async (
  mediaId: string,
  section: MediaSection,
  options?: {
    accessToken?: string;
  },
): Promise<PublicMediaUrlResponse> => {
  const query = new URLSearchParams({
    section,
  });

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/public/media/${encodeURIComponent(mediaId)}/url?${query.toString()}`,
    method: "GET",
    accessToken: options?.accessToken,
    fallbackErrorMessage: "Failed to load public media URL.",
  });

  const normalized = normalizeMediaUrlResponse(payload);

  if (!normalized) {
    throw new ApiClientError({
      message: "Invalid public media URL response.",
      status: 500,
      payload,
    });
  }

  return normalized;
};

export const getAdminMediaUrl = async ({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<AdminMediaUrlResponse> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/media/${encodeURIComponent(mediaId)}/url`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load admin media URL.",
  });

  const normalized = normalizeMediaUrlResponse(payload);
  const root = asRecord(payload);

  if (!normalized) {
    throw new ApiClientError({
      message: "Invalid admin media URL response.",
      status: 500,
      payload,
    });
  }

  return {
    ...normalized,
    productId: normalized.productId ?? asNullableString(root?.productId),
    consignmentAgreementId:
      normalized.consignmentAgreementId ?? asNullableString(root?.consignmentAgreementId),
    slot: normalized.slot ?? normalizeMediaSlot(root?.slot),
  };
};

export const deleteAdminMedia = async ({
  accessToken,
  mediaId,
}: {
  accessToken: string;
  mediaId: string;
}) => {
  const response = await fetch(`${API_BASE_PATH}/admin/media/${encodeURIComponent(mediaId)}`, {
    method: "DELETE",
    headers: buildHeaders({
      accessToken,
      headers: {
        "Content-Type": "application/json",
      },
    }),
    cache: "no-store",
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const errorPayload = asRecord(payload) as ApiErrorPayload | null;

    throw new ApiClientError({
      message: buildErrorMessage(errorPayload, "Failed to delete media."),
      status: response.status,
      code: asNullableString(errorPayload?.code),
      reason: asNullableString(errorPayload?.reason),
      payload,
    });
  }

  return payload;
};

export type AdminProductRoleMediaInput = {
  roleVisibility: string;
  mediaIds: string[];
};

export type AdminProductPublicMediaInput = {
  thumbnailMediaId?: string | null;
  featureVideoMediaId?: string | null;
  galleryMediaIds?: string[];
  certificateMediaId?: string | null;
};

export type AdminProductRoleBasedMediaInput = {
  mediaId: string;
  allowedRoles: string[];
  displayOrder?: number | null;
};

export type AdminProductCommissionAllocationInput = {
  targetType: "BRANCH" | "USER" | string;
  beneficiaryUserId?: string | null;
  beneficiaryBranchId?: string | null;
  rate: number;
  note?: string | null;
};

export type AdminProductUpsertPayload = {
  sku?: string | null;
  name?: string | null;
  color?: string | null;
  origin?: string | null;
  description?: string | null;
  buyPrice?: number | null;
  saleMinPrice?: number | null;
  saleMaxPrice?: number | null;
  weight?: number | null;
  weightUnit?: string | null;
  length?: number | null;
  depth?: number | null;
  height?: number | null;
  importDate?: string | null;
  importId?: string | null;
  fromCompanyId?: string | null;
  visibility?: string | null;
  tier?: string | null;
  status?: string | null;
  minCustomerTier?: string | null;
  targetUserIds?: string[];
  visibilityNote?: string | null;
  sourceType?: string | null;
  consignmentRate?: number | null;
  consignmentAgreementId?: string | null;
  consignmentContractMediaId?: string | null;
  publicMedia?: AdminProductPublicMediaInput | null;
  roleBasedMedia?: AdminProductRoleBasedMediaInput[];
  thumbnailImageId?: string | null;
  featureVideoId?: string | null;
  galleryImageIds?: string[];
  certificateMediaIds?: string[];
  roleMedia?: AdminProductRoleMediaInput[];
  commissionAllocations?: AdminProductCommissionAllocationInput[];
};

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeIdList = (values: string[] | null | undefined) =>
  [...new Set((Array.isArray(values) ? values : []).map((entry) => asString(entry)).filter(Boolean))];

const normalizeFiniteOrNull = (value: unknown) => {
  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const normalizeRoleList = (values: string[] | null | undefined) =>
  [...new Set(
    (Array.isArray(values) ? values : [])
      .map((entry) => asString(entry).toUpperCase())
      .filter((entry): entry is MediaRole => entry === "ADMIN" || entry === "MANAGER" || entry === "SALES"),
  )];

const normalizeAdminProductPayload = (input: AdminProductUpsertPayload): JsonRecord => {
  const body: JsonRecord = {};

  if (hasOwn(input, "sku")) {
    body.sku = asString(input.sku);
  }
  if (hasOwn(input, "name")) {
    body.name = asNullableString(input.name);
  }
  if (hasOwn(input, "color")) {
    body.color = asNullableString(input.color);
  }
  if (hasOwn(input, "origin")) {
    body.origin = asNullableString(input.origin);
  }
  if (hasOwn(input, "description")) {
    body.description = asNullableString(input.description);
  }
  if (hasOwn(input, "buyPrice")) {
    body.buyPrice = normalizeFiniteOrNull(input.buyPrice);
  }
  if (hasOwn(input, "saleMinPrice")) {
    body.saleMinPrice = normalizeFiniteOrNull(input.saleMinPrice);
  }
  if (hasOwn(input, "saleMaxPrice")) {
    body.saleMaxPrice = normalizeFiniteOrNull(input.saleMaxPrice);
  }
  if (hasOwn(input, "weight")) {
    body.weight = normalizeFiniteOrNull(input.weight);
  }
  if (hasOwn(input, "weightUnit")) {
    body.weightUnit = asNullableString(input.weightUnit)?.toUpperCase() ?? null;
  }
  if (hasOwn(input, "length")) {
    body.length = normalizeFiniteOrNull(input.length);
  }
  if (hasOwn(input, "depth")) {
    body.depth = normalizeFiniteOrNull(input.depth);
  }
  if (hasOwn(input, "height")) {
    body.height = normalizeFiniteOrNull(input.height);
  }
  if (hasOwn(input, "importDate")) {
    body.importDate = asNullableString(input.importDate);
  }
  if (hasOwn(input, "importId")) {
    body.importId = asNullableString(input.importId);
  }
  if (hasOwn(input, "fromCompanyId")) {
    body.fromCompanyId = asNullableString(input.fromCompanyId);
  }
  if (hasOwn(input, "visibility")) {
    body.visibility = asNullableString(input.visibility)?.toUpperCase() ?? null;
  }
  if (hasOwn(input, "tier")) {
    body.tier = asNullableString(input.tier)?.toUpperCase() ?? null;
  }
  if (hasOwn(input, "status")) {
    body.status = asNullableString(input.status)?.toUpperCase() ?? null;
  }
  if (hasOwn(input, "minCustomerTier")) {
    body.minCustomerTier = asNullableString(input.minCustomerTier)?.toUpperCase() ?? null;
  }
  if (hasOwn(input, "targetUserIds")) {
    body.targetUserIds = normalizeIdList(input.targetUserIds);
  }
  if (hasOwn(input, "visibilityNote")) {
    body.visibilityNote = asNullableString(input.visibilityNote);
  }
  if (hasOwn(input, "sourceType")) {
    body.sourceType = asNullableString(input.sourceType)?.toUpperCase() ?? null;
  }
  if (hasOwn(input, "consignmentRate")) {
    body.consignmentRate = normalizeFiniteOrNull(input.consignmentRate);
  }
  if (hasOwn(input, "consignmentAgreementId")) {
    body.consignmentAgreementId = asNullableString(input.consignmentAgreementId);
  }
  if (hasOwn(input, "consignmentContractMediaId")) {
    body.consignmentContractMediaId = asNullableString(input.consignmentContractMediaId);
  }

  const normalizedPublicMedia =
    hasOwn(input, "publicMedia") && input.publicMedia
      ? {
          thumbnailMediaId: asNullableString(input.publicMedia.thumbnailMediaId),
          featureVideoMediaId: asNullableString(input.publicMedia.featureVideoMediaId),
          galleryMediaIds: normalizeIdList(input.publicMedia.galleryMediaIds),
          certificateMediaId: asNullableString(input.publicMedia.certificateMediaId),
        }
      : hasOwn(input, "thumbnailImageId") ||
          hasOwn(input, "featureVideoId") ||
          hasOwn(input, "galleryImageIds") ||
          hasOwn(input, "certificateMediaIds")
        ? {
            thumbnailMediaId: asNullableString(input.thumbnailImageId),
            featureVideoMediaId: asNullableString(input.featureVideoId),
            galleryMediaIds: normalizeIdList(input.galleryImageIds),
            certificateMediaId: normalizeIdList(input.certificateMediaIds)[0] ?? null,
          }
        : null;

  if (normalizedPublicMedia) {
    body.publicMedia = {
      ...(normalizedPublicMedia.thumbnailMediaId
        ? { thumbnailMediaId: normalizedPublicMedia.thumbnailMediaId }
        : {}),
      ...(normalizedPublicMedia.featureVideoMediaId
        ? { featureVideoMediaId: normalizedPublicMedia.featureVideoMediaId }
        : {}),
      ...(normalizedPublicMedia.galleryMediaIds.length
        ? { galleryMediaIds: normalizedPublicMedia.galleryMediaIds }
        : {}),
      ...(normalizedPublicMedia.certificateMediaId
        ? { certificateMediaId: normalizedPublicMedia.certificateMediaId }
        : {}),
    };
  }

  const normalizedRoleBasedMedia =
    hasOwn(input, "roleBasedMedia")
      ? (Array.isArray(input.roleBasedMedia) ? input.roleBasedMedia : [])
          .map((row) => ({
            mediaId: asString(row?.mediaId),
            allowedRoles: normalizeRoleList(row?.allowedRoles),
            ...(typeof row?.displayOrder === "number" && Number.isFinite(row.displayOrder)
              ? { displayOrder: row.displayOrder }
              : {}),
          }))
          .filter((row) => row.mediaId && row.allowedRoles.length > 0)
      : hasOwn(input, "roleMedia")
        ? (Array.isArray(input.roleMedia) ? input.roleMedia : []).flatMap((row) => {
            const roleVisibility = asString(row?.roleVisibility).toUpperCase();
            const allowedRoles = normalizeRoleList(roleVisibility ? [roleVisibility] : []);

            if (allowedRoles.length === 0) {
              return [];
            }

            return normalizeIdList(row?.mediaIds).map((mediaId, index) => ({
              mediaId,
              allowedRoles,
              displayOrder: index,
            }));
          })
        : [];

  if (normalizedRoleBasedMedia.length > 0) {
    body.roleBasedMedia = normalizedRoleBasedMedia;
  }
  if (hasOwn(input, "commissionAllocations")) {
    body.commissionAllocations = (Array.isArray(input.commissionAllocations)
      ? input.commissionAllocations
      : []
    )
      .map((row) => ({
        targetType: asString(row?.targetType).toUpperCase(),
        ...(asString(row?.beneficiaryUserId)
          ? { beneficiaryUserId: asString(row?.beneficiaryUserId) }
          : {}),
        ...(asString(row?.beneficiaryBranchId)
          ? { beneficiaryBranchId: asString(row?.beneficiaryBranchId) }
          : {}),
        rate: normalizeFiniteOrNull(row?.rate),
        ...(asString(row?.note) ? { note: asString(row?.note) } : {}),
      }))
      .filter(
        (row) =>
          (row.targetType === "BRANCH" || row.targetType === "USER") &&
          typeof row.rate === "number",
      );
  }

  return body;
};

export const createAdminProduct = async ({
  accessToken,
  product,
}: {
  accessToken: string;
  product: AdminProductUpsertPayload;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/products`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizeAdminProductPayload(product)),
    fallbackErrorMessage: "Failed to create product.",
  });

  return normalizeAdminActionResponse(201, response.payload, response.status);
};

export const updateAdminProduct = async ({
  accessToken,
  productId,
  product,
}: {
  accessToken: string;
  productId: string;
  product: AdminProductUpsertPayload;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/products/${encodeURIComponent(productId)}`,
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizeAdminProductPayload(product)),
    fallbackErrorMessage: "Failed to update product.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const updateAdminProductQuickVisibility = async ({
  accessToken,
  productId,
  visibility,
  minCustomerTier,
  targetUserIds,
  visibilityNote,
  reason,
}: {
  accessToken: string;
  productId: string;
  visibility: string;
  minCustomerTier?: string | null;
  targetUserIds?: string[];
  visibilityNote?: string | null;
  reason?: string | null;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/products/${encodeURIComponent(productId)}/quick-visibility`,
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      visibility: asString(visibility).toUpperCase(),
      ...(minCustomerTier ? { minCustomerTier: asString(minCustomerTier).toUpperCase() } : {}),
      ...(targetUserIds?.length ? { targetUserIds } : {}),
      ...(visibilityNote ? { visibilityNote: visibilityNote.trim() } : {}),
      ...(reason ? { reason: reason.trim() } : {}),
    }),
    fallbackErrorMessage: "Failed to update product visibility.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const deleteAdminProduct = async ({
  accessToken,
  productId,
  reason,
}: {
  accessToken: string;
  productId: string;
  reason?: string | null;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/products/${encodeURIComponent(productId)}`,
    method: "DELETE",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reason ? { reason: reason.trim() } : {}),
    fallbackErrorMessage: "Failed to delete product.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const getAdminProducts = async ({
  accessToken,
  page,
  limit,
  includeSold,
  search,
  status,
  visibility,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  includeSold?: boolean;
  search?: string;
  status?: string;
  visibility?: string;
}): Promise<AdminProductsResponse> => {
  const query = new URLSearchParams();

  if (page && page > 0) {
    query.set("page", String(page));
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }
  if (typeof includeSold === "boolean") {
    query.set("includeSold", includeSold ? "true" : "false");
  }
  if (search) {
    query.set("search", search.trim());
  }
  if (status) {
    query.set("status", asString(status).toUpperCase());
  }
  if (visibility) {
    query.set("visibility", asString(visibility).toUpperCase());
  }

  const queryString = query.toString();
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/products${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load admin products.",
  });

  const rows = extractPaginatedRows(payload)
    .map((row) => normalizeAdminProductRow(row))
    .filter((row): row is AdminProductRecord => Boolean(row));
  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const getAdminProductDetail = async ({
  accessToken,
  productId,
}: {
  accessToken: string;
  productId: string;
}): Promise<AdminProductRecord> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/products/${encodeURIComponent(productId)}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load product details.",
  });

  const product =
    normalizeAdminProductRow(payload) ??
    normalizeAdminProductRow(asRecord(payload)?.product) ??
    normalizeAdminProductRow(asRecord(payload)?.item);

  if (!product) {
    throw new ApiClientError({
      message: "Invalid admin product detail response.",
      status: 500,
      payload,
    });
  }

  return product;
};

export const getAdminInventoryProfitAnalytics = async ({
  accessToken,
  includeSold,
}: {
  accessToken: string;
  includeSold?: boolean;
}): Promise<AdminInventoryProfitAnalytics> => {
  const query = new URLSearchParams();
  if (typeof includeSold === "boolean") {
    query.set("includeSold", includeSold ? "true" : "false");
  }

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/analytics/inventory-profit${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load inventory profit analytics.",
  });

  const root = asRecord(payload) ?? {};
  const totals = asRecord(root.totals) ?? {};
  const inventory = Array.isArray(root.inventory) ? root.inventory : [];

  return {
    includeSold: root.includeSold === true,
    totals: {
      productCount: asNonNegativeInt(totals.productCount) ?? 0,
      pricedProductCount: asNonNegativeInt(totals.pricedProductCount) ?? 0,
      unpricedProductCount: asNonNegativeInt(totals.unpricedProductCount) ?? 0,
      projectedRevenueMin: asFiniteNumberish(totals.projectedRevenueMin) ?? 0,
      projectedRevenueMax: asFiniteNumberish(totals.projectedRevenueMax) ?? 0,
      projectedNetProfitMin: asFiniteNumberish(totals.projectedNetProfitMin) ?? 0,
      projectedNetProfitMax: asFiniteNumberish(totals.projectedNetProfitMax) ?? 0,
    },
    inventory,
    raw: payload,
  };
};

export const getAdminUsers = async ({
  accessToken,
  page,
  limit,
  accountStatus,
  status,
  role,
  search,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  accountStatus?: AdminAccountStatus | string;
  status?: AdminAccountStatus | string;
  role?: AdminUserRole | string;
  search?: string;
}): Promise<AdminUsersResponse> => {
  const query = new URLSearchParams();

  if (page && page > 0) {
    query.set("page", String(page));
  }

  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  if (accountStatus) {
    query.set("status", asString(accountStatus));
  } else if (status) {
    query.set("status", asString(status));
  }

  if (role) {
    query.set("role", asString(role));
  }

  if (search) {
    query.set("search", search.trim());
  }

  const queryString = query.toString();
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/users${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load admin users.",
  });

  const rows = extractPaginatedRows(payload)
    .map((row) => normalizeAdminUserRow(row))
    .filter((row): row is AdminUserListItem => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const getUserMe = async ({
  accessToken,
}: {
  accessToken: string;
}): Promise<UserMeResponse> => {
  return runWithInFlightDeduplication(`getUserMe:${accessToken}`, async () => {
    const payload = await fetchJson({
      path: `${API_BASE_PATH}/user/me`,
      method: "GET",
      accessToken,
      fallbackErrorMessage: "Failed to load account profile.",
    });

    const root = asRecord(payload) ?? {};

    return {
      id: asNullableString(root.id),
      supabaseUserId: asNullableString(root.supabaseUserId),
      email: asNullableString(root.email),
      role: asNullableString(root.role),
      status: asNullableString(root.status),
      isSetup: root.isSetup === true,
      isMainAdmin: root.isMainAdmin === true,
      accountAccess:
        normalizeAccountAccess(root.accountAccess) ??
        normalizeAccountAccess(asRecord(root.details)?.accountAccess) ??
        null,
      raw: payload,
    };
  });
};

export const getAdminUserDetail = async ({
  accessToken,
  userId,
}: {
  accessToken: string;
  userId: string;
}): Promise<AdminUserDetail> => {
  return runWithInFlightDeduplication(
    `getAdminUserDetail:${userId}:${accessToken}`,
    async () => {
      const payload = await fetchJson({
        path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}`,
        method: "GET",
        accessToken,
        fallbackErrorMessage: "Failed to load user details.",
      });

      const detail = normalizeAdminUserDetail(payload);
      if (!detail) {
        throw new ApiClientError({
          message: "Invalid user detail response.",
          status: 500,
          payload,
        });
      }

      return detail;
    },
  );
};

export const updateAdminUserPermissions = async ({
  accessToken,
  userId,
  permissions,
}: {
  accessToken: string;
  userId: string;
  permissions: Record<string, unknown>;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}/permissions`,
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(permissions),
    fallbackErrorMessage: "Failed to update user permissions.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const updateAdminUserStatus = async ({
  accessToken,
  userId,
  status,
  reason,
}: {
  accessToken: string;
  userId: string;
  status: AdminAccountStatus | string;
  reason?: string;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}/status`,
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: asString(status).toUpperCase(),
      ...(reason ? { reason: reason.trim() } : {}),
    }),
    fallbackErrorMessage: "Failed to update user status.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const createAdminUserRestriction = async ({
  accessToken,
  userId,
  reason,
  note,
  startsAt,
  endsAt,
  restrictionMode,
  adminActionBlocks,
}: {
  accessToken: string;
  userId: string;
  reason?: string;
  note?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  restrictionMode?: AdminRestrictionMode | string;
  adminActionBlocks?: Array<AdminActionBlock | string>;
}) =>
  upsertAdminUserRestriction({
    accessToken,
    userId,
    reason,
    note,
    startsAt,
    endsAt,
    restrictionMode,
    adminActionBlocks,
  });

export const upsertAdminUserRestriction = async ({
  accessToken,
  userId,
  restrictionId,
  reason,
  note,
  restrictionMode,
  adminActionBlocks,
  startsAt,
  endsAt,
  isActive,
  metadata,
}: {
  accessToken: string;
  userId: string;
  restrictionId?: string;
  reason?: string;
  note?: string | null;
  restrictionMode?: AdminRestrictionMode | string;
  adminActionBlocks?: Array<AdminActionBlock | string>;
  startsAt?: string;
  endsAt?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}): Promise<AdminActionResponse> => {
  const body: Record<string, unknown> = {
    type: "RESTRICTION",
  };

  if (restrictionId) body.restrictionId = restrictionId.trim();
  if (reason) body.reason = reason.trim();
  if (note !== undefined) body.note = note;
  if (restrictionMode) body.restrictionMode = asString(restrictionMode).toUpperCase();
  if (Array.isArray(adminActionBlocks)) {
    body.adminActionBlocks = adminActionBlocks
      .map((item) => asString(item).toUpperCase())
      .filter(Boolean);
  }
  if (startsAt !== undefined) body.startsAt = startsAt;
  if (endsAt !== undefined) body.endsAt = endsAt;
  if (typeof isActive === "boolean") body.isActive = isActive;
  if (metadata !== undefined) body.metadata = metadata;

  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}/restrictions`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    fallbackErrorMessage: "Failed to save user restriction.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const createAdminUserBan = async ({
  accessToken,
  userId,
  reason,
  note,
  startsAt,
  endsAt,
}: {
  accessToken: string;
  userId: string;
  reason: string;
  note?: string | null;
  startsAt?: string;
  endsAt?: string | null;
}) =>
  banAdminUser({
    accessToken,
    userId,
    reason,
    note,
    startsAt,
    endsAt,
  });

export const banAdminUser = async ({
  accessToken,
  userId,
  reason,
  note,
  startsAt,
  endsAt,
  durationHours,
  durationDays,
  metadata,
}: {
  accessToken: string;
  userId: string;
  reason: string;
  note?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  durationHours?: number | null;
  durationDays?: number | null;
  metadata?: Record<string, unknown> | null;
}): Promise<AdminActionResponse> => {
  const body: Record<string, unknown> = {
    type: "BAN",
    reason: reason.trim(),
  };

  if (note !== undefined) body.note = note;
  if (startsAt !== undefined) body.startsAt = startsAt;
  if (endsAt !== undefined) body.endsAt = endsAt;
  if (durationHours !== undefined && durationHours !== null) body.durationHours = durationHours;
  if (durationDays !== undefined && durationDays !== null) body.durationDays = durationDays;
  if (metadata !== undefined) body.metadata = metadata;

  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}/ban`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    fallbackErrorMessage: "Failed to ban user.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const resolveAdminUserAction = async ({
  accessToken,
  userId,
  actionType,
  controlId,
  note,
}: {
  accessToken: string;
  userId: string;
  actionType: "RESTRICTION" | "BAN" | "TERMINATION" | string;
  controlId?: string;
  note?: string;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}/admin-actions/resolve`,
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actionType: asString(actionType).toUpperCase(),
      ...(controlId ? { controlId: controlId.trim() } : {}),
      ...(note ? { note: note.trim() } : {}),
    }),
    fallbackErrorMessage: "Failed to resolve user access action.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const getAdminUserAuditLogs = async ({
  accessToken,
  userId,
  scope = "ALL",
  page,
  limit,
  from,
  to,
}: {
  accessToken: string;
  userId: string;
  scope?: "ALL" | "ACTOR" | "ENTITY" | string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<AdminAuditLogsResponse> => {
  const query = new URLSearchParams();

  if (scope) {
    query.set("scope", asString(scope).toUpperCase());
  }
  if (page && page > 0) {
    query.set("page", String(page));
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }
  if (from) {
    query.set("from", from);
  }
  if (to) {
    query.set("to", to);
  }

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}/audit-logs${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load user audit logs.",
  });

  const rows = extractAuditRows(payload)
    .map((row) => normalizeAuditRow(row))
    .filter((row): row is AdminAuditLogRow => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const getAdminUserApprovalRequests = async ({
  accessToken,
  userId,
  status,
  relation = "ALL",
  page,
  limit,
}: {
  accessToken: string;
  userId: string;
  status?: AdminApprovalRequestStatus | string;
  relation?: "ALL" | "SUBMITTED" | "TARGETED" | string;
  page?: number;
  limit?: number;
}): Promise<AdminApprovalRequestsResponse> => {
  const query = new URLSearchParams();

  if (status) {
    query.set("status", asString(status).toUpperCase());
  }
  if (relation) {
    query.set("relation", asString(relation).toUpperCase());
  }
  if (page && page > 0) {
    query.set("page", String(page));
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/users/${encodeURIComponent(userId)}/approval-requests${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load user approval requests.",
  });

  const rows = extractPaginatedRows(payload)
    .map((row) => normalizeAdminApprovalRequest(row))
    .filter((row): row is AdminApprovalRequest => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const getAdminApprovalRequests = async ({
  accessToken,
  page,
  limit,
  status,
  actionType,
  targetUserId,
  requestedByUserId,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  status?: AdminApprovalRequestStatus | string;
  actionType?: AdminApprovalActionType | string;
  targetUserId?: string;
  requestedByUserId?: string;
}): Promise<AdminApprovalRequestsResponse> => {
  const query = new URLSearchParams();

  if (page && page > 0) {
    query.set("page", String(page));
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }
  if (status) {
    query.set("status", asString(status).toUpperCase());
  }
  if (actionType) {
    query.set("actionType", asString(actionType).toUpperCase());
  }
  if (targetUserId) {
    query.set("targetUserId", targetUserId.trim());
  }
  if (requestedByUserId) {
    query.set("requestedByUserId", requestedByUserId.trim());
  }

  const queryString = query.toString();
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/approval-requests${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load approval requests.",
  });

  const rows = extractPaginatedRows(payload)
    .map((row) => normalizeAdminApprovalRequest(row))
    .filter((row): row is AdminApprovalRequest => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const decideAdminApprovalRequest = async ({
  accessToken,
  requestId,
  decision,
  decisionNote,
  enableAutoApproveForFuture,
  overrides,
}: {
  accessToken: string;
  requestId: string;
  decision: AdminApprovalDecision | string;
  decisionNote?: string;
  enableAutoApproveForFuture?: boolean;
  overrides?: Record<string, unknown>;
}): Promise<AdminActionResponse> => {
  const response = await fetchJsonResponse({
    path: `${API_BASE_PATH}/admin/approval-requests/${encodeURIComponent(requestId)}/decision`,
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      decision: asString(decision).toUpperCase(),
      ...(decisionNote ? { decisionNote: decisionNote.trim() } : {}),
      ...(typeof enableAutoApproveForFuture === "boolean"
        ? { enableAutoApproveForFuture }
        : {}),
      ...(overrides ?? {}),
    }),
    fallbackErrorMessage: "Failed to decide approval request.",
  });

  return normalizeAdminActionResponse(200, response.payload, response.status);
};

export const getAdminBranchesWithManagers = async ({
  accessToken,
  page,
  limit,
  status,
  includeInactive,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  status?: AdminBranchStatus | string;
  includeInactive?: boolean;
}): Promise<AdminBranchesWithManagersResponse> => {
  const query = new URLSearchParams();

  if (page && page > 0) {
    query.set("page", String(page));
  }

  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  if (status) {
    query.set("status", asString(status));
  }

  if (typeof includeInactive === "boolean") {
    query.set("includeInactive", includeInactive ? "true" : "false");
  }

  const queryString = query.toString();
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/branches-with-managers${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load branches.",
  });

  const rows = extractPaginatedRows(payload)
    .map((row) => normalizeAdminBranchRow(row))
    .filter((row): row is AdminBranchWithManagersRecord => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const getAdminBranchAnalytics = async ({
  accessToken,
  status,
  includeInactiveBranches,
  rows,
}: {
  accessToken: string;
  status?: AdminBranchStatus | string;
  includeInactiveBranches?: boolean;
  rows?: number;
}): Promise<AdminBranchNetworkResponse> => {
  const query = new URLSearchParams();
  const normalizedRows =
    typeof rows === "number" && Number.isFinite(rows)
      ? Math.min(50, Math.max(10, Math.trunc(rows)))
      : null;

  if (status) {
    query.set("status", asString(status).toUpperCase());
  }
  if (typeof includeInactiveBranches === "boolean") {
    query.set(
      "includeInactiveBranches",
      includeInactiveBranches ? "true" : "false",
    );
  }
  if (normalizedRows !== null) {
    query.set("rows", String(normalizedRows));
  }

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/analytics/branches${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load branch network analytics.",
  });

  const root = asRecord(payload) ?? {};
  const items = extractPaginatedRows(payload)
    .map((row) => normalizeAdminBranchNetworkRow(row))
    .filter((row): row is AdminBranchNetworkRecord => Boolean(row));
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: items.length,
  });

  return {
    items,
    summary: asRecord(root.summary) ?? asRecord(root.analytics),
    ...pagination,
    raw: payload,
  };
};

export const getAdminBranchDetail = async ({
  accessToken,
  branchId,
}: {
  accessToken: string;
  branchId: string;
}): Promise<AdminBranchDetailResponse> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/branches/${encodeURIComponent(branchId)}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load branch detail.",
  });

  const root = asRecord(payload) ?? {};
  const branch =
    normalizeAdminBranchNetworkRow(root.branch) ??
    normalizeAdminBranchNetworkRow(payload) ??
    null;
  const users = Array.isArray(root.users)
    ? root.users
        .map((row) => normalizeAdminBranchUserRow(row))
        .filter((row): row is AdminBranchUserRecord => Boolean(row))
    : [];
  const recentAuditLogs = Array.isArray(root.recentAuditLogs)
    ? root.recentAuditLogs
        .map((row) => normalizeAuditRow(row))
        .filter((row): row is AdminAuditLogRow => Boolean(row))
    : [];

  return {
    branch,
    analytics: asRecord(root.analytics),
    users,
    recentAuditLogs,
    raw: payload,
  };
};

export const getAdminBranchMembers = async ({
  accessToken,
  branchId,
}: {
  accessToken: string;
  branchId: string;
}): Promise<AdminBranchUserRecord[]> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/branches/${encodeURIComponent(branchId)}/members`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load branch members.",
  });

  return extractPaginatedRows(payload)
    .map((row) => normalizeAdminBranchUserRow(row))
    .filter((row): row is AdminBranchUserRecord => Boolean(row));
};

export const getAdminBranchAuditLogs = async ({
  accessToken,
  branchId,
  page,
  limit,
  from,
  to,
  action,
  entityType,
}: {
  accessToken: string;
  branchId: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  action?: string;
  entityType?: string;
}): Promise<AdminAuditLogsResponse> => {
  const query = new URLSearchParams();

  if (page && page > 0) {
    query.set("page", String(page));
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }
  if (from) {
    query.set("from", from);
  }
  if (to) {
    query.set("to", to);
  }
  if (action) {
    query.set("action", action);
  }
  if (entityType) {
    query.set("entityType", entityType);
  }

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/branches/${encodeURIComponent(branchId)}/audit-logs${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load branch audit logs.",
  });

  const rows = extractAuditRows(payload)
    .map((row) => normalizeAuditRow(row))
    .filter((row): row is AdminAuditLogRow => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const getAdminCustomers = async ({
  accessToken,
  page,
  limit,
  search,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<AdminCustomersResponse> => {
  const query = new URLSearchParams();

  if (page && page > 0) {
    query.set("page", String(page));
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }
  if (search) {
    query.set("search", search.trim());
  }

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/customers${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load customers.",
  });

  const rows = extractPaginatedRows(payload)
    .map((row) => normalizeAdminCustomerRow(row))
    .filter((row): row is AdminCustomerListItem => Boolean(row));
  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const getAdminInventoryRequests = async ({
  accessToken,
  page,
  limit,
  status,
  requestStatus,
  branchId,
  appointmentId,
  appointmentItemId,
  productId,
  requestedByUserId,
  from,
  to,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  status?: AdminInventoryRequestStatus | string | Array<AdminInventoryRequestStatus | string>;
  requestStatus?: AdminInventoryRequestStatus | string | Array<AdminInventoryRequestStatus | string>;
  branchId?: string;
  appointmentId?: string;
  appointmentItemId?: string;
  productId?: string;
  requestedByUserId?: string;
  from?: string;
  to?: string;
}): Promise<AdminInventoryRequestsResponse> => {
  const query = new URLSearchParams();

  if (page && page > 0) {
    query.set("page", String(page));
  }

  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  setCsvQuery(query, "status", status || requestStatus);

  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  if (appointmentId) {
    query.set("appointmentId", appointmentId.trim());
  }

  if (appointmentItemId) {
    query.set("appointmentItemId", appointmentItemId.trim());
  }

  if (productId) {
    query.set("productId", productId.trim());
  }

  if (requestedByUserId) {
    query.set("requestedByUserId", requestedByUserId.trim());
  }

  if (from) {
    query.set("from", from);
  }

  if (to) {
    query.set("to", to);
  }

  const queryString = query.toString();
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/inventory-requests${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load inventory requests.",
  });

  const rows = extractPaginatedRows(payload)
    .map((row) => normalizeInventoryRequestRow(row))
    .filter((row): row is AdminInventoryRequestRecord => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    filters: asRecord(root.filters),
    ...pagination,
    raw: payload,
  };
};

export const getAdminAuditLogs = async ({
  accessToken,
  page,
  limit,
  actorUserId,
  actorId,
  branchId,
  action,
  entityType,
  entityId,
  query,
  from,
  to,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  actorUserId?: string;
  actorId?: string;
  branchId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  query?: string;
  from?: string;
  to?: string;
}): Promise<AdminAuditLogsResponse> => {
  const search = new URLSearchParams();

  if (page && page > 0) {
    search.set("page", String(page));
  }

  if (limit && limit > 0) {
    search.set("limit", String(limit));
  }

  if (actorUserId) {
    search.set("actorUserId", actorUserId);
  } else if (actorId) {
    search.set("actorUserId", actorId);
  }

  if (branchId) {
    search.set("branchId", branchId);
  }

  if (action) {
    search.set("action", action);
  }

  if (entityType) {
    search.set("entityType", entityType);
  }

  if (entityId) {
    search.set("entityId", entityId);
  }

  if (query) {
    search.set("query", query);
  }

  if (from) {
    search.set("from", from);
  }

  if (to) {
    search.set("to", to);
  }

  const queryString = search.toString();
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/audit-logs${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load audit logs.",
  });

  const rows = extractAuditRows(payload)
    .map((row) => normalizeAuditRow(row))
    .filter((row): row is AdminAuditLogRow => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const clearAdminAuditLogs = async (
  reason: string,
  options: {
    accessToken: string;
  },
): Promise<ClearAdminAuditLogsResponse> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/audit-logs`,
    method: "DELETE",
    accessToken: options.accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason,
    }),
    fallbackErrorMessage: "Failed to clear audit logs.",
  });

  const root = asRecord(payload) ?? {};
  const backup = asRecord(root.backup) ?? {};

  return {
    message: asString(root.message) || "Audit logs cleared.",
    backupFileName:
      asNullableString(root.backupFileName) ||
      asNullableString(root.fileName) ||
      asNullableString(backup.fileName),
    backupFileSizeBytes:
      asFiniteNumber(root.backupFileSizeBytes) ??
      asFiniteNumber(root.sizeBytes) ??
      asFiniteNumber(backup.sizeBytes),
    backupRecordCount:
      asFiniteNumber(root.backupRecordCount) ??
      asFiniteNumber(root.recordCount) ??
      asFiniteNumber(backup.recordCount),
    backupGeneratedAt:
      asNullableString(root.backupGeneratedAt) ||
      asNullableString(root.generatedAt) ||
      asNullableString(backup.generatedAt),
    raw: payload,
  };
};

export const getAdminInternalErrorLogs = async ({
  accessToken,
  page,
  limit,
  actorUserId,
  source,
  process,
  functionName,
  requestId,
  colorCode,
  message,
  from,
  to,
}: {
  accessToken: string;
  page?: number;
  limit?: number;
  actorUserId?: string;
  source?: string;
  process?: string;
  functionName?: string;
  requestId?: string;
  colorCode?: string;
  message?: string;
  from?: string;
  to?: string;
}): Promise<AdminInternalErrorLogsResponse> => {
  const search = new URLSearchParams();

  if (page && page > 0) {
    search.set("page", String(page));
  }

  if (limit && limit > 0) {
    search.set("limit", String(limit));
  }

  if (actorUserId) {
    search.set("actorUserId", actorUserId);
  }

  if (source) {
    search.set("source", source);
  }

  if (process) {
    search.set("process", process);
  }

  if (functionName) {
    search.set("functionName", functionName);
  }

  if (requestId) {
    search.set("requestId", requestId);
  }

  if (colorCode) {
    search.set("colorCode", colorCode);
  }

  if (message) {
    search.set("message", message);
  }

  if (from) {
    search.set("from", from);
  }

  if (to) {
    search.set("to", to);
  }

  const queryString = search.toString();
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/internal-error-logs${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load internal error logs.",
  });

  const rows = extractInternalErrorRows(payload)
    .map((row) => normalizeInternalErrorRow(row))
    .filter((row): row is AdminInternalErrorLogRow => Boolean(row));

  const root = asRecord(payload) ?? {};
  const pagination = normalizeAuditPagination({
    payload: root,
    rowCount: rows.length,
  });

  return {
    items: rows,
    ...pagination,
    raw: payload,
  };
};

export const clearAdminInternalErrorLogs = async (
  reason: string,
  options: {
    accessToken: string;
  },
): Promise<ClearAdminInternalErrorLogsResponse> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/internal-error-logs`,
    method: "DELETE",
    accessToken: options.accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason,
    }),
    fallbackErrorMessage: "Failed to clear internal error logs.",
  });

  const root = asRecord(payload) ?? {};
  const backup = asRecord(root.backup) ?? {};

  return {
    message: asString(root.message) || "Internal error logs cleared.",
    deletedCount: asFiniteNumber(root.deletedCount) ?? asFiniteNumber(root.count),
    backupFileName:
      asNullableString(root.backupFileName) ||
      asNullableString(root.fileName) ||
      asNullableString(backup.fileName),
    backupFileSizeBytes:
      asFiniteNumber(root.backupFileSizeBytes) ??
      asFiniteNumber(root.sizeBytes) ??
      asFiniteNumber(backup.sizeBytes),
    backupRecordCount:
      asFiniteNumber(root.backupRecordCount) ??
      asFiniteNumber(root.recordCount) ??
      asFiniteNumber(root.totalRecords) ??
      asFiniteNumber(backup.totalRecords) ??
      asFiniteNumber(backup.recordCount),
    backupGeneratedAt:
      asNullableString(root.backupGeneratedAt) ||
      asNullableString(root.generatedAt) ||
      asNullableString(backup.generatedAt),
    raw: payload,
  };
};

export const getAdminLogBackups = async ({
  accessToken,
  type = "audit",
}: {
  accessToken: string;
  type?: string;
}): Promise<AdminLogBackupsResponse> => {
  const query = new URLSearchParams({
    type,
  });

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/log-backups?${query.toString()}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load audit log backups.",
  });

  const files = extractBackupRows(payload)
    .map((row) => {
      const item = asRecord(row);
      if (!item) {
        return null;
      }

      const fileName = asString(item.fileName) || asString(item.name);
      if (!fileName) {
        return null;
      }

      return {
        fileName,
        sizeBytes: asFiniteNumber(item.sizeBytes),
        recordCount: asFiniteNumber(item.recordCount) ?? asFiniteNumber(item.records),
        generatedAt: asNullableString(item.generatedAt),
        type: asNullableString(item.type),
        raw: item,
      } satisfies AdminLogBackupFile;
    })
    .filter((item): item is AdminLogBackupFile => Boolean(item));

  return {
    files,
    raw: payload,
  };
};

export const getAdminLogHistory = async ({
  accessToken,
  type = "all",
  limit = 200,
}: {
  accessToken: string;
  type?: LogHistoryType;
  limit?: number;
}): Promise<AdminLogHistoryResponse> => {
  const query = new URLSearchParams({
    type,
    limit: String(Math.max(1, Math.min(1000, Math.floor(limit || 200)))),
  });

  const payload = await fetchJson({
    path: `${API_BASE_PATH}/log/history?${query.toString()}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load log history.",
  });

  const root = asRecord(payload) ?? {};
  const items: AdminLogHistoryItem[] = [];

  for (const row of extractLogHistoryRows(payload)) {
    const item = asRecord(row);
    if (!item) {
      continue;
    }

    const fileName = asString(item.fileName) || asString(item.name);
    if (!fileName) {
      continue;
    }

    items.push({
      fileName,
      relativePath: asNullableString(item.relativePath),
      category: asNullableString(item.category),
      sizeBytes: asFiniteNumber(item.sizeBytes),
      createdAt: asNullableString(item.createdAt),
      updatedAt: asNullableString(item.updatedAt),
      data: item.data ?? null,
      parseError: asNullableString(item.parseError),
      raw: item,
    });
  }

  const countValue = asFiniteNumber(root.count);

  return {
    type: normalizeLogHistoryType(root.type ?? type),
    limit: asPositiveInt(root.limit) ?? Math.max(1, Math.min(1000, Math.floor(limit || 200))),
    count:
      countValue !== null && Number.isInteger(countValue) && countValue >= 0
        ? countValue
        : items.length,
    items,
    raw: payload,
  };
};

const normalizeStaffRuleUser = (value: unknown): StaffRuleUser | null => {
  const obj = asRecord(value);
  if (!obj) return null;
  const id = asString(obj.id);
  if (!id) return null;
  return {
    id,
    email: asNullableString(obj.email),
    role: asNullableString(obj.role),
  };
};

const normalizeStaffRuleBranch = (value: unknown): StaffRuleBranch | null => {
  const obj = asRecord(value);
  if (!obj) return null;
  const id = asString(obj.id);
  if (!id) return null;
  return {
    id,
    code: asNullableString(obj.code),
    name: asNullableString(obj.name),
    status: asNullableString(obj.status),
  };
};

const normalizeStaffRulePermissions = (value: unknown): JsonRecord | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return record;
};

const normalizeStaffRule = (rawRow: unknown): StaffOnboardingRule | null => {
  const row = asRecord(rawRow);
  if (!row) return null;

  const id = asString(row.id);
  const role = asString(row.role);
  if (!id || !role) return null;

  return {
    id,
    role,
    permissions:
      normalizeStaffRulePermissions(row.permissions) ??
      normalizeStaffRulePermissions(row.permission),
    email: asNullableString(row.email),
    emailNormalized: asNullableString(row.emailNormalized),
    phone: asNullableString(row.phone),
    phoneNormalized: asNullableString(row.phoneNormalized),
    displayName: asNullableString(row.displayName),
    lineId: asNullableString(row.lineId),
    note: asNullableString(row.note),
    branchId: asNullableString(row.branchId),
    setAsPrimaryManager: row.setAsPrimaryManager === true,
    expiresAt: asNullableString(row.expiresAt),
    claimedAt: asNullableString(row.claimedAt),
    revokedAt: asNullableString(row.revokedAt),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    createdByUserId: asNullableString(row.createdByUserId),
    claimedByUserId: asNullableString(row.claimedByUserId),
    revokedByUserId: asNullableString(row.revokedByUserId),
    branch: normalizeStaffRuleBranch(row.branch),
    createdByUser: normalizeStaffRuleUser(row.createdByUser),
    claimedByUser: normalizeStaffRuleUser(row.claimedByUser),
    revokedByUser: normalizeStaffRuleUser(row.revokedByUser),
    status: asString(row.status) || "PENDING",
    raw: row,
  };
};

const extractStaffRules = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];
  if (Array.isArray(root.rules)) return root.rules;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.data)) return root.data;
  return [];
};

type StaffRuleActorScope = "admin" | "manager";

const staffRuleScopePath = (scope: StaffRuleActorScope) =>
  scope === "manager" ? "manager" : "admin";

const buildCreateStaffRuleBody = (payload: CreateStaffRulePayload) => {
  const body: Record<string, unknown> = {
    role: payload.role,
    email: payload.email,
    phone: payload.phone,
  };

  if (payload.displayName !== undefined) body.displayName = payload.displayName;
  if (payload.lineId !== undefined) body.lineId = payload.lineId;
  if (payload.note !== undefined) body.note = payload.note;
  if (payload.branchId !== undefined) body.branchId = payload.branchId;
  if (payload.branchName !== undefined) body.branchName = payload.branchName;
  if (payload.setAsPrimaryManager !== undefined) body.setAsPrimaryManager = payload.setAsPrimaryManager;
  if (payload.expiresAt !== undefined) body.expiresAt = payload.expiresAt;

  const hasBranchId = payload.branchId !== undefined && payload.branchId !== null && payload.branchId !== "";
  const hasBranchName =
    payload.branchName !== undefined && payload.branchName !== null && payload.branchName !== "";

  if (hasBranchId && hasBranchName) {
    throw new ApiClientError({
      message: "Use either branchId or branchName, but not both.",
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  const hasPermissions = payload.permissions !== undefined;
  const hasPermission = payload.permission !== undefined;

  if (hasPermissions && hasPermission) {
    throw new ApiClientError({
      message: "Use either permissions or permission, but not both.",
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  if (hasPermissions) {
    body.permissions = payload.permissions;
  }

  if (hasPermission) {
    body.permission = payload.permission;
  }

  return body;
};

const getStaffRules = async ({
  scope,
  accessToken,
  status,
  limit,
}: {
  scope: StaffRuleActorScope;
  accessToken: string;
  status?: string;
  limit?: number;
}): Promise<StaffOnboardingRule[]> => {
  const search = new URLSearchParams();

  if (status) {
    search.set("status", status);
  }

  if (limit && limit > 0) {
    search.set("limit", String(limit));
  }

  const queryString = search.toString();
  const scopePath = staffRuleScopePath(scope);
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/${scopePath}/staff-onboarding/rules${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load staff onboarding rules.",
  });

  return extractStaffRules(payload)
    .map((row) => normalizeStaffRule(row))
    .filter((row): row is StaffOnboardingRule => Boolean(row));
};

const createStaffRule = async ({
  scope,
  accessToken,
  payload,
}: {
  scope: StaffRuleActorScope;
  accessToken: string;
  payload: CreateStaffRulePayload;
}): Promise<StaffOnboardingRule> => {
  const scopePath = staffRuleScopePath(scope);
  const responsePayload = await fetchJson({
    path: `${API_BASE_PATH}/${scopePath}/staff-onboarding/rules`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildCreateStaffRuleBody(payload)),
    fallbackErrorMessage: "Failed to create staff onboarding rule.",
  });

  const rule = normalizeStaffRule(responsePayload);
  if (!rule) {
    throw new ApiClientError({
      message: "Invalid staff rule response.",
      status: 500,
      payload: responsePayload,
    });
  }

  return rule;
};

const revokeStaffRule = async ({
  scope,
  accessToken,
  ruleId,
}: {
  scope: StaffRuleActorScope;
  accessToken: string;
  ruleId: string;
}): Promise<StaffOnboardingRule> => {
  const scopePath = staffRuleScopePath(scope);
  const responsePayload = await fetchJson({
    path: `${API_BASE_PATH}/${scopePath}/staff-onboarding/rules/${encodeURIComponent(ruleId)}/revoke`,
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    fallbackErrorMessage: "Failed to revoke staff onboarding rule.",
  });

  const rule = normalizeStaffRule(responsePayload);
  if (!rule) {
    throw new ApiClientError({
      message: "Invalid revoke response.",
      status: 500,
      payload: responsePayload,
    });
  }

  return rule;
};

export const getAdminStaffRules = async ({
  accessToken,
  status,
  limit,
}: {
  accessToken: string;
  status?: string;
  limit?: number;
}): Promise<StaffOnboardingRule[]> => {
  return getStaffRules({
    scope: "admin",
    accessToken,
    status,
    limit,
  });
};

export const createAdminStaffRule = async ({
  accessToken,
  payload,
}: {
  accessToken: string;
  payload: CreateStaffRulePayload;
}): Promise<StaffOnboardingRule> => {
  return createStaffRule({
    scope: "admin",
    accessToken,
    payload,
  });
};

export const revokeAdminStaffRule = async ({
  accessToken,
  ruleId,
}: {
  accessToken: string;
  ruleId: string;
}): Promise<StaffOnboardingRule> => {
  return revokeStaffRule({
    scope: "admin",
    accessToken,
    ruleId,
  });
};

export const getManagerStaffRules = async ({
  accessToken,
  status,
  limit,
}: {
  accessToken: string;
  status?: string;
  limit?: number;
}): Promise<StaffOnboardingRule[]> => {
  return getStaffRules({
    scope: "manager",
    accessToken,
    status,
    limit,
  });
};

export const createManagerStaffRule = async ({
  accessToken,
  payload,
}: {
  accessToken: string;
  payload: CreateStaffRulePayload;
}): Promise<StaffOnboardingRule> => {
  return createStaffRule({
    scope: "manager",
    accessToken,
    payload,
  });
};

export const revokeManagerStaffRule = async ({
  accessToken,
  ruleId,
}: {
  accessToken: string;
  ruleId: string;
}): Promise<StaffOnboardingRule> => {
  return revokeStaffRule({
    scope: "manager",
    accessToken,
    ruleId,
  });
};

export const downloadAdminLogBackup = async ({
  accessToken,
  fileName,
}: {
  accessToken: string;
  fileName: string;
}) => {
  const response = await fetch(
    `${API_BASE_PATH}/admin/log-backups/${encodeURIComponent(fileName)}`,
    {
      method: "GET",
      headers: buildHeaders({
        accessToken,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    const errorPayload = asRecord(payload) as ApiErrorPayload | null;

    throw new ApiClientError({
      message: buildErrorMessage(errorPayload, "Failed to download backup file."),
      status: response.status,
      code: asNullableString(errorPayload?.code),
      reason: asNullableString(errorPayload?.reason),
      payload,
    });
  }

  return response;
};
