import {
  API_BASE_PATH,
  ApiClientError,
  type CustomerTier,
  type MediaAudience,
  type MediaRole,
  type MediaSection,
  type MediaVisibilityPreset,
} from "./apiClient";

type JsonRecord = Record<string, unknown>;

type ApiErrorPayload = {
  message?: unknown;
  code?: unknown;
  reason?: unknown;
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
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const asBoolean = (value: unknown) => value === true;

const asNullableBoolean = (value: unknown) => {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }

  return null;
};

const asPositiveInt = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.floor(numeric);
};

const normalizeCustomerTier = (value: unknown): CustomerTier | null => {
  const normalized = asString(value).toUpperCase();
  if (normalized === "REGULAR" || normalized === "VIP" || normalized === "ULTRA_VIP") {
    return normalized;
  }

  return null;
};

const normalizeMediaAudience = (value: unknown): MediaAudience | null => {
  const normalized = asString(value).toUpperCase();
  if (
    normalized === "PUBLIC" ||
    normalized === "TARGETED" ||
    normalized === "ADMIN_ONLY" ||
    normalized === "ROLE_BASED" ||
    normalized === "PRIVATE"
  ) {
    return normalized;
  }

  return null;
};

const normalizeMediaRoleList = (value: unknown): MediaRole[] =>
  Array.isArray(value)
    ? value
        .map((entry) => asString(entry).toUpperCase())
        .filter(
          (entry): entry is MediaRole =>
            entry === "ADMIN" || entry === "MANAGER" || entry === "SALES",
        )
    : [];

const normalizeMediaSections = (value: unknown): MediaSection[] =>
  Array.isArray(value)
    ? value
        .map((entry) => asString(entry).toUpperCase())
        .filter(
          (entry): entry is MediaSection =>
            entry === "PRODUCT_PAGE" ||
            entry === "TOP_SHELF" ||
            entry === "VIP" ||
            entry === "PRIVATE",
        )
    : [];

const normalizeMediaVisibilityPreset = (
  value: unknown,
): MediaVisibilityPreset | null => {
  const normalized = asString(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (
    normalized === "PUBLIC" ||
    normalized === "TOP_SHELF" ||
    normalized === "USER_TIER" ||
    normalized === "TARGETED_USER" ||
    normalized === "PRIVATE" ||
    normalized === "ADMIN" ||
    normalized === "MANAGER" ||
    normalized === "SALES"
  ) {
    return normalized;
  }

  return null;
};

export type ManagerProductVisibility =
  | "PRIVATE"
  | "STAFF"
  | "PUBLIC"
  | "TOP_SHELF"
  | "USER_TIER"
  | "TARGETED_USER";

const normalizeManagerProductVisibility = (
  value: unknown,
): ManagerProductVisibility | null => {
  const normalized = asString(value).toUpperCase();
  if (
    normalized === "PRIVATE" ||
    normalized === "STAFF" ||
    normalized === "PUBLIC" ||
    normalized === "TOP_SHELF" ||
    normalized === "USER_TIER" ||
    normalized === "TARGETED_USER"
  ) {
    return normalized;
  }

  return null;
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

const managerPath = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_PATH}/manager${normalized}`;
};

const fetchManagerJson = async ({
  accessToken,
  path,
  method = "GET",
  body,
  fallbackErrorMessage,
}: {
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  fallbackErrorMessage: string;
}) => {
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
  };

  let serializedBody: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    serializedBody = JSON.stringify(body);
  }

  const response = await fetch(managerPath(path), {
    method,
    headers,
    body: serializedBody,
    cache: "no-store",
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const errorPayload = asRecord(payload) as ApiErrorPayload | null;

    throw new ApiClientError({
      message: `${buildErrorMessage(errorPayload, fallbackErrorMessage)} [HTTP ${response.status}]`,
      status: response.status,
      code: asNullableString(errorPayload?.code),
      reason: asNullableString(errorPayload?.reason),
      payload,
    });
  }

  return payload;
};

const setCsvQuery = (search: URLSearchParams, key: string, value?: string | string[]) => {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    const normalized = value.map((entry) => asString(entry)).filter(Boolean);
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

const extractRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  const candidates = [
    root.records,
    root.items,
    root.data,
    root.branches,
    root.salespersons,
    root.products,
    root.users,
    root.appointments,
    root.possessions,
    root.selectedProducts,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

export type ManagerBranchRef = {
  id: string;
  code: string | null;
  name: string | null;
  city: string | null;
  status: string | null;
};

const normalizeManagerBranch = (value: unknown): ManagerBranchRef | null => {
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
  };
};

export type ManagerBranchUser = {
  membershipId: string;
  memberRole: string | null;
  isPrimary: boolean;
  assignedAt: string | null;
  branchId: string | null;
  branch: ManagerBranchRef | null;
  userId: string;
  email: string | null;
  role: string | null;
  status: string | null;
  displayName: string | null;
  accessRestrictionCount: number;
  commissionSummary: {
    salespersonPolicyCount: number;
    activeSalespersonPolicyCount: number;
    productAllocationCount: number;
    highestActivePolicyRate: number | null;
    highestProductAllocationRate: number | null;
  };
  raw: JsonRecord;
};

export type ManagerBranchUsersResponse = {
  branch: ManagerBranchRef | null;
  totalUsers: number;
  users: ManagerBranchUser[];
  raw: unknown;
};

const normalizeManagerBranchUser = (
  value: unknown,
  fallbackBranch?: ManagerBranchRef | null,
): ManagerBranchUser | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const membershipId =
    asString(row.membershipId) ||
    asString(row.id);
  const user = asRecord(row.user);
  const userId = asString(user?.id);

  if (!membershipId || !userId) {
    return null;
  }

  const managerProfile = asRecord(user?.managerProfile);
  const salespersonProfile = asRecord(user?.salespersonProfile);
  const commissions = asRecord(row.commissions);
  const summary = asRecord(commissions?.summary);
  const branch = normalizeManagerBranch(row.branch) ?? fallbackBranch ?? null;

  return {
    membershipId,
    memberRole: asNullableString(row.memberRole),
    isPrimary: asBoolean(row.isPrimary),
    assignedAt: asNullableString(row.assignedAt),
    branchId: asNullableString(row.branchId) || branch?.id || null,
    branch,
    userId,
    email: asNullableString(user?.email),
    role: asNullableString(user?.role),
    status: asNullableString(user?.status),
    displayName:
      asNullableString(managerProfile?.displayName) ||
      asNullableString(salespersonProfile?.displayName) ||
      asNullableString(user?.displayName),
    accessRestrictionCount: Array.isArray(user?.accessRestrictions)
      ? user.accessRestrictions.length
      : 0,
    commissionSummary: {
      salespersonPolicyCount: asPositiveInt(summary?.salespersonPolicyCount) ?? 0,
      activeSalespersonPolicyCount:
        asPositiveInt(summary?.activeSalespersonPolicyCount) ?? 0,
      productAllocationCount: asPositiveInt(summary?.productAllocationCount) ?? 0,
      highestActivePolicyRate: asFiniteNumber(summary?.highestActivePolicyRate),
      highestProductAllocationRate: asFiniteNumber(
        summary?.highestProductAllocationRate,
      ),
    },
    raw: row,
  };
};

export const getManagerBranchUsers = async ({
  accessToken,
  branchId,
}: {
  accessToken: string;
  branchId?: string;
}): Promise<ManagerBranchUsersResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/branch-users${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load branch users.",
  });

  const root = asRecord(payload) ?? {};
  const branch = normalizeManagerBranch(root.branch);
  const users = extractRows(payload)
    .map((entry) => normalizeManagerBranchUser(entry, branch))
    .filter((entry): entry is ManagerBranchUser => Boolean(entry));

  return {
    branch,
    totalUsers: asPositiveInt(root.totalUsers) ?? users.length,
    users,
    raw: payload,
  };
};

export const filterManagerBranchStaff = (
  rows: ManagerBranchUser[],
  roles: Array<"MANAGER" | "SALES"> = ["MANAGER", "SALES"],
) => {
  const allowed = new Set(roles);
  return rows.filter((row) => {
    const role = asString(row.role).toUpperCase();
    return role === "MANAGER" || role === "SALES"
      ? allowed.has(role as "MANAGER" | "SALES")
      : false;
  });
};

export type ManagerProductMediaReference = {
  id: string | null;
  type: string | null;
  url: string | null;
  originalUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  slot: string | null;
  visibilitySections: MediaSection[];
  audience: MediaAudience | null;
  allowedRoles: MediaRole[];
  minCustomerTier: CustomerTier | null;
  targetUsers: Array<{
    userId: string;
  }>;
  visibilityPreset: MediaVisibilityPreset | null;
  isPrimary: boolean;
  displayOrder: number | null;
  raw: JsonRecord;
};

const normalizeStringList = (value: unknown) =>
  Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];

const normalizeManagerProductMedia = (
  value: unknown,
): ManagerProductMediaReference | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asNullableString(row.id);
  const type = asNullableString(row.type);
  const url =
    asNullableString(row.previewUrl) ||
    asNullableString(row.signedUrl) ||
    asNullableString(row.url) ||
    asNullableString(asRecord(row.media)?.url);
  const originalUrl = asNullableString(row.originalUrl);
  const mimeType = asNullableString(row.mimeType);
  const sizeBytes = asFiniteNumber(row.sizeBytes);
  const slot = asNullableString(row.slot);
  const visibilitySections = normalizeMediaSections(row.visibilitySections);
  const audience = normalizeMediaAudience(row.audience);
  const allowedRoles = normalizeMediaRoleList(row.allowedRoles);
  const minCustomerTier = normalizeCustomerTier(row.minCustomerTier);
  const targetUsers = Array.isArray(row.targetUsers)
    ? row.targetUsers
        .map((entry) => asRecord(entry))
        .map((entry) => ({ userId: asString(entry?.userId) }))
        .filter((entry) => Boolean(entry.userId))
    : [];
  const visibilityPreset = normalizeMediaVisibilityPreset(row.visibilityPreset);
  const isPrimary = asBoolean(row.isPrimary);
  const displayOrder = asPositiveInt(row.displayOrder) ?? asFiniteNumber(row.displayOrder);

  if (
    !id &&
    !type &&
    !url &&
    !originalUrl &&
    !mimeType &&
    sizeBytes === null &&
    !slot &&
    !visibilitySections.length &&
    !audience &&
    !allowedRoles.length &&
    !minCustomerTier &&
    !targetUsers.length &&
    !visibilityPreset
  ) {
    return null;
  }

  return {
    id,
    type,
    url,
    originalUrl,
    mimeType,
    sizeBytes,
    slot,
    visibilitySections,
    audience,
    allowedRoles,
    minCustomerTier,
    targetUsers,
    visibilityPreset,
    isPrimary,
    displayOrder,
    raw: row,
  };
};

const scoreManagerProductMediaPreview = (media: ManagerProductMediaReference) => {
  const slot = asString(media.slot).toUpperCase();
  const type = asString(media.type).toUpperCase();
  const mimeType = asString(media.mimeType).toUpperCase();
  let score = 0;

  if (media.isPrimary) score += 120;
  if (slot.includes("THUMBNAIL")) score += 100;
  if (slot.includes("PRIMARY")) score += 90;
  if (slot.includes("GALLERY")) score += 80;
  if (slot.includes("FEATURE_VIDEO")) score -= 100;
  if (slot.includes("VIDEO")) score -= 80;
  if (slot.includes("CERTIFICATE")) score -= 40;

  if (type === "IMAGE" || type.startsWith("IMAGE/")) score += 20;
  if (mimeType.startsWith("IMAGE/")) score += 20;
  if (type === "VIDEO" || type.startsWith("VIDEO/")) score -= 50;
  if (mimeType.startsWith("VIDEO/")) score -= 50;
  if (mimeType === "APPLICATION/PDF") score -= 30;

  if (media.url) score += 5;
  if (media.originalUrl) score += 1;
  if (media.id) score += 3;
  if (media.displayOrder !== null) score += Math.max(20 - media.displayOrder, 0);

  return score;
};

const extractManagerProductPreview = (row: JsonRecord) => {
  const publicMedia = asRecord(row.publicMedia);
  const media = Array.isArray(row.media)
    ? row.media
        .map((entry) => normalizeManagerProductMedia(entry))
        .filter((entry): entry is ManagerProductMediaReference => Boolean(entry))
    : [];
  const preferredMedia = [...media]
    .filter((entry) => entry.url || entry.originalUrl || entry.id)
    .sort((left, right) => scoreManagerProductMediaPreview(right) - scoreManagerProductMediaPreview(left))[0];

  const directPreviewUrl =
    preferredMedia?.url ??
    preferredMedia?.originalUrl ??
    asNullableString(row.previewImageUrl) ??
    asNullableString(row.previewUrl) ??
    asNullableString(row.signedUrl) ??
    asNullableString(row.thumbnailUrl) ??
    asNullableString(row.imageUrl) ??
    asNullableString(row.mediaUrl) ??
    asNullableString(row.url);
  const directPreviewMediaId =
    preferredMedia?.id ??
    asNullableString(publicMedia?.thumbnailMediaId) ??
    asNullableString(row.thumbnailImageId) ??
    normalizeStringList(publicMedia?.galleryMediaIds)[0] ??
    normalizeStringList(row.galleryImageIds)[0] ??
    null;

  return {
    media,
    previewImageUrl: directPreviewUrl,
    previewImageMediaId: directPreviewMediaId,
  };
};

export type ManagerProductSummary = {
  id: string;
  sku: string | null;
  name: string | null;
  tier: string | null;
  status: string | null;
  visibility: ManagerProductVisibility | null;
  minCustomerTier: CustomerTier | null;
  saleRangeMin: number | null;
  saleRangeMax: number | null;
  isSelectedForBranch: boolean;
  branchCommissionRate: number | null;
  projectedBranchCommissionMin: number | null;
  projectedBranchCommissionMax: number | null;
  selectedValue: number | null;
  targetedUsersCount: number;
  previewImageUrl: string | null;
  previewImageMediaId: string | null;
  media: ManagerProductMediaReference[];
  branchRequestState: {
    totalRequests: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    remainingRetries: number;
    cooldownMinutes: number;
    retryLimit: number;
    cooldownActive: boolean;
    cooldownEndsAt: string | null;
    cooldownResolvedAt: string | null;
    canRequest: boolean;
    blockReason: string | null;
    note: string | null;
    lastRequestedAt: string | null;
    lastRejectedAt: string | null;
    lastApprovedAt: string | null;
  } | null;
  raw: JsonRecord;
};

const normalizeManagerProduct = (value: unknown): ManagerProductSummary | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const saleRange = asRecord(row.saleRange);
  const projectedRange = asRecord(row.projectedBranchCommissionRange);
  const branchRequestState = asRecord(row.branchRequestState);
  const preview = extractManagerProductPreview(row);

  return {
    id,
    sku: asNullableString(row.sku),
    name: asNullableString(row.name),
    tier: asNullableString(row.tier),
    status: asNullableString(row.status),
    visibility: normalizeManagerProductVisibility(row.visibility),
    minCustomerTier: normalizeCustomerTier(row.minCustomerTier),
    saleRangeMin: asFiniteNumber(saleRange?.min),
    saleRangeMax: asFiniteNumber(saleRange?.max),
    isSelectedForBranch: asBoolean(row.isSelectedForBranch),
    branchCommissionRate: asFiniteNumber(row.branchCommissionRate),
    projectedBranchCommissionMin: asFiniteNumber(projectedRange?.min),
    projectedBranchCommissionMax: asFiniteNumber(projectedRange?.max),
    selectedValue: asFiniteNumber(row.selectedValue),
    targetedUsersCount: asPositiveInt(row.targetedUsersCount) ?? 0,
    previewImageUrl: preview.previewImageUrl,
    previewImageMediaId: preview.previewImageMediaId,
    media: preview.media,
    branchRequestState: branchRequestState
      ? {
          totalRequests: asPositiveInt(branchRequestState.totalRequests) ?? 0,
          pendingCount: asPositiveInt(branchRequestState.pendingCount) ?? 0,
          approvedCount: asPositiveInt(branchRequestState.approvedCount) ?? 0,
          rejectedCount: asPositiveInt(branchRequestState.rejectedCount) ?? 0,
          remainingRetries: asPositiveInt(branchRequestState.remainingRetries) ?? 0,
          cooldownMinutes: asPositiveInt(branchRequestState.cooldownMinutes) ?? 60,
          retryLimit: asPositiveInt(branchRequestState.retryLimit) ?? 5,
          cooldownActive: asBoolean(branchRequestState.cooldownActive),
          cooldownEndsAt: asNullableString(branchRequestState.cooldownEndsAt),
          cooldownResolvedAt: asNullableString(branchRequestState.cooldownResolvedAt),
          canRequest: branchRequestState.canRequest !== false,
          blockReason: asNullableString(branchRequestState.blockReason),
          note: asNullableString(branchRequestState.note),
          lastRequestedAt: asNullableString(branchRequestState.lastRequestedAt),
          lastRejectedAt: asNullableString(branchRequestState.lastRejectedAt),
          lastApprovedAt: asNullableString(branchRequestState.lastApprovedAt),
        }
      : null,
    raw: row,
  };
};

export type ManagerDashboardBranch = ManagerBranchRef & {
  membershipsCount: number;
  appointmentsCount: number;
  productPossessionsCount: number;
  salesTotalCount: number;
  salesTotalAmount: number;
  appointmentsByStatus: Array<{
    status: string;
    count: number;
  }>;
  raw: JsonRecord;
};

export type ManagerDashboardResponse = {
  branchCount: number;
  branches: ManagerDashboardBranch[];
  raw: unknown;
};

const normalizeDashboardBranch = (value: unknown): ManagerDashboardBranch | null => {
  const row = asRecord(value);
  const branch = normalizeManagerBranch(value);

  if (!row || !branch) {
    return null;
  }

  const counts = asRecord(row._count);
  const sales = asRecord(row.sales);
  const appointmentsByStatus = Array.isArray(row.appointmentsByStatus)
    ? row.appointmentsByStatus
        .map((entry) => {
          const item = asRecord(entry);
          const status = asString(item?.status);
          if (!status) {
            return null;
          }

          return {
            status,
            count: asPositiveInt(item?.count) ?? 0,
          };
        })
        .filter(
          (entry): entry is { status: string; count: number } =>
            Boolean(entry),
        )
    : [];

  return {
    ...branch,
    membershipsCount: asPositiveInt(counts?.memberships) ?? 0,
    appointmentsCount: asPositiveInt(counts?.appointments) ?? 0,
    productPossessionsCount: asPositiveInt(counts?.productPossessions) ?? 0,
    salesTotalCount: asPositiveInt(sales?.totalCount) ?? 0,
    salesTotalAmount: asFiniteNumber(sales?.totalAmount) ?? 0,
    appointmentsByStatus,
    raw: row,
  };
};

export const getManagerDashboard = async ({
  accessToken,
  branchId,
}: {
  accessToken: string;
  branchId?: string;
}): Promise<ManagerDashboardResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/dashboard${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load manager dashboard.",
  });

  const root = asRecord(payload) ?? {};
  const branches = extractRows(payload)
    .map((entry) => normalizeDashboardBranch(entry))
    .filter((entry): entry is ManagerDashboardBranch => Boolean(entry));

  return {
    branchCount: asPositiveInt(root.branchCount) ?? branches.length,
    branches,
    raw: payload,
  };
};

export type ManagerSalespersonListItem = {
  membershipId: string;
  branchId: string | null;
  assignedAt: string | null;
  userId: string;
  email: string | null;
  status: string | null;
  displayName: string | null;
  branch: ManagerBranchRef | null;
  raw: JsonRecord;
};

export type ManagerDashboardSalespersonsResponse = {
  branchIds: string[];
  statusFilter: string[];
  availableStatusFilters: string[];
  counts: Record<string, number>;
  salespersons: ManagerSalespersonListItem[];
  raw: unknown;
};

const normalizeManagerSalesperson = (value: unknown): ManagerSalespersonListItem | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const membershipId = asString(row.id);
  const user = asRecord(row.user);
  const userId = asString(user?.id);

  if (!membershipId || !userId) {
    return null;
  }

  const salespersonProfile = asRecord(user?.salespersonProfile);

  return {
    membershipId,
    branchId: asNullableString(row.branchId),
    assignedAt: asNullableString(row.assignedAt),
    userId,
    email: asNullableString(user?.email),
    status: asNullableString(user?.status),
    displayName:
      asNullableString(salespersonProfile?.displayName) ||
      asNullableString(user?.displayName),
    branch: normalizeManagerBranch(row.branch),
    raw: row,
  };
};

export const getManagerDashboardSalespersons = async ({
  accessToken,
  branchId,
  status,
}: {
  accessToken: string;
  branchId?: string;
  status?: string | string[];
}): Promise<ManagerDashboardSalespersonsResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  setCsvQuery(query, "status", status);

  const payload = await fetchManagerJson({
    accessToken,
    path: `/dashboard/salespersons${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load salespersons.",
  });

  const root = asRecord(payload) ?? {};
  const records = extractRows(payload)
    .map((entry) => normalizeManagerSalesperson(entry))
    .filter((entry): entry is ManagerSalespersonListItem => Boolean(entry));

  const counts: Record<string, number> = {};
  const rawCounts = asRecord(root.counts) ?? {};
  for (const [key, value] of Object.entries(rawCounts)) {
    counts[key] = asPositiveInt(value) ?? 0;
  }

  const branchIds = Array.isArray(root.branchIds)
    ? root.branchIds.map((entry) => asString(entry)).filter(Boolean)
    : [];
  const statusFilter = Array.isArray(root.statusFilter)
    ? root.statusFilter.map((entry) => asString(entry)).filter(Boolean)
    : [];
  const availableStatusFilters = Array.isArray(root.availableStatusFilters)
    ? root.availableStatusFilters.map((entry) => asString(entry)).filter(Boolean)
    : [];

  return {
    branchIds,
    statusFilter,
    availableStatusFilters,
    counts,
    salespersons: records,
    raw: payload,
  };
};

export type ManagerBranchAnalyticsRecord = {
  branch: ManagerBranchRef | null;
  summary: {
    selectedProductsCount: number;
    totalSaleRangeMin: number;
    totalSaleRangeMax: number;
    totalCommissionRangeMin: number;
    totalCommissionRangeMax: number;
  };
  requestSummary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
  selectedProducts: Array<{
    allocationId: string | null;
    productId: string | null;
    commissionRate: number | null;
    saleRangeMin: number | null;
    saleRangeMax: number | null;
    projectedCommissionRangeMin: number | null;
    projectedCommissionRangeMax: number | null;
    raw: JsonRecord;
  }>;
  raw: JsonRecord;
};

export type ManagerBranchAnalyticsResponse = {
  branchCount: number;
  branches: ManagerBranchAnalyticsRecord[];
  raw: unknown;
};

const normalizeManagerBranchAnalytics = (
  value: unknown,
): ManagerBranchAnalyticsRecord | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const summary = asRecord(row.summary) ?? {};
  const requestSummary = asRecord(row.requestSummary) ?? {};
  const selectedProducts = Array.isArray(row.selectedProducts)
    ? row.selectedProducts
        .map((entry) => {
          const item = asRecord(entry);
          if (!item) {
            return null;
          }

          const saleRange = asRecord(item.saleRange);
          const projectedRange = asRecord(item.projectedCommissionRange);

          return {
            allocationId: asNullableString(item.allocationId),
            productId: asNullableString(item.productId),
            commissionRate: asFiniteNumber(item.commissionRate),
            saleRangeMin: asFiniteNumber(saleRange?.min),
            saleRangeMax: asFiniteNumber(saleRange?.max),
            projectedCommissionRangeMin: asFiniteNumber(projectedRange?.min),
            projectedCommissionRangeMax: asFiniteNumber(projectedRange?.max),
            raw: item,
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            allocationId: string | null;
            productId: string | null;
            commissionRate: number | null;
            saleRangeMin: number | null;
            saleRangeMax: number | null;
            projectedCommissionRangeMin: number | null;
            projectedCommissionRangeMax: number | null;
            raw: JsonRecord;
          } => Boolean(entry),
        )
    : [];

  return {
    branch: normalizeManagerBranch(row.branch),
    summary: {
      selectedProductsCount: asPositiveInt(summary.selectedProductsCount) ?? 0,
      totalSaleRangeMin: asFiniteNumber(summary.totalSaleRangeMin) ?? 0,
      totalSaleRangeMax: asFiniteNumber(summary.totalSaleRangeMax) ?? 0,
      totalCommissionRangeMin: asFiniteNumber(summary.totalCommissionRangeMin) ?? 0,
      totalCommissionRangeMax: asFiniteNumber(summary.totalCommissionRangeMax) ?? 0,
    },
    requestSummary: {
      total: asPositiveInt(requestSummary.total) ?? 0,
      pending: asPositiveInt(requestSummary.pending) ?? 0,
      approved: asPositiveInt(requestSummary.approved) ?? 0,
      rejected: asPositiveInt(requestSummary.rejected) ?? 0,
      cancelled: asPositiveInt(requestSummary.cancelled) ?? 0,
    },
    selectedProducts,
    raw: row,
  };
};

export const getManagerAnalyticsBranches = async ({
  accessToken,
  branchId,
  requestStatus,
}: {
  accessToken: string;
  branchId?: string;
  requestStatus?: string;
}): Promise<ManagerBranchAnalyticsResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  if (requestStatus) {
    query.set("requestStatus", asString(requestStatus).toUpperCase());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/analytics/branches${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load branch analytics.",
  });

  const root = asRecord(payload) ?? {};
  const branches = extractRows(payload)
    .map((entry) => normalizeManagerBranchAnalytics(entry))
    .filter((entry): entry is ManagerBranchAnalyticsRecord => Boolean(entry));

  return {
    branchCount: asPositiveInt(root.branchCount) ?? branches.length,
    branches,
    raw: payload,
  };
};

export type ManagerProductsResponse = {
  branchId: string | null;
  count: number;
  products: ManagerProductSummary[];
  raw: unknown;
};

export const getManagerProducts = async ({
  accessToken,
  branchId,
}: {
  accessToken: string;
  branchId?: string;
}): Promise<ManagerProductsResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/products${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load products.",
  });

  const root = asRecord(payload) ?? {};
  const products = extractRows(payload)
    .map((entry) => normalizeManagerProduct(entry))
    .filter((entry): entry is ManagerProductSummary => Boolean(entry));

  return {
    branchId: asNullableString(root.branchId),
    count: asPositiveInt(root.count) ?? products.length,
    products,
    raw: payload,
  };
};

export type ManagerCustomerListItem = {
  userId: string;
  displayName: string | null;
  tier: CustomerTier | null;
  email: string | null;
  status: string | null;
  isTargetedForProduct: boolean;
  raw: JsonRecord;
};

export type ManagerCustomersResponse = {
  branchId: string | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  product: {
    id: string;
    visibility: ManagerProductVisibility | null;
    targetedUsersCount: number;
  } | null;
  records: ManagerCustomerListItem[];
  raw: unknown;
};

const normalizeManagerCustomer = (
  value: unknown,
): ManagerCustomerListItem | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const user = asRecord(row.user);
  const userId = asString(row.userId) || asString(user?.id);
  if (!userId) {
    return null;
  }

  return {
    userId,
    displayName: asNullableString(row.displayName),
    tier: normalizeCustomerTier(row.tier),
    email: asNullableString(user?.email) || asNullableString(row.email),
    status: asNullableString(user?.status) || asNullableString(row.status),
    isTargetedForProduct: asBoolean(row.isTargetedForProduct),
    raw: row,
  };
};

export const getManagerCustomers = async ({
  accessToken,
  branchId,
  page,
  limit,
  search,
  tier,
  accountStatus,
  productId,
}: {
  accessToken: string;
  branchId?: string;
  page?: number;
  limit?: number;
  search?: string;
  tier?: CustomerTier;
  accountStatus?: "ACTIVE" | "RESTRICTED" | "BANNED" | "TERMINATED";
  productId?: string;
}): Promise<ManagerCustomersResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  if (page && page > 0) {
    query.set("page", String(page));
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }
  if (search) {
    query.set("search", search.trim());
  }
  if (tier) {
    query.set("tier", tier);
  }
  if (accountStatus) {
    query.set("accountStatus", accountStatus);
  }
  if (productId) {
    query.set("productId", productId.trim());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/customers${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load customers.",
  });

  const root = asRecord(payload) ?? {};
  const product = asRecord(root.product);
  const records = extractRows(payload)
    .map((entry) => normalizeManagerCustomer(entry))
    .filter((entry): entry is ManagerCustomerListItem => Boolean(entry));

  return {
    branchId: asNullableString(root.branchId),
    page: asPositiveInt(root.page) ?? 1,
    limit: asPositiveInt(root.limit) ?? records.length,
    total: asPositiveInt(root.total) ?? records.length,
    totalPages: asPositiveInt(root.totalPages) ?? (records.length ? 1 : 0),
    product: product
      ? {
          id: asString(product.id),
          visibility: normalizeManagerProductVisibility(product.visibility),
          targetedUsersCount: asPositiveInt(product.targetedUsersCount) ?? 0,
        }
      : null,
    records,
    raw: payload,
  };
};

export type ManagerPendingAppointmentItem = {
  id: string;
  productId: string | null;
  fulfillmentStatus: string | null;
  requestedSource: string | null;
  product: {
    id: string;
    sku: string | null;
    name: string | null;
    status: string | null;
  } | null;
  raw: JsonRecord;
};

export type ManagerPendingAppointment = {
  id: string;
  status: string | null;
  appointmentDate: string | null;
  branchId: string | null;
  salespersonUserId: string | null;
  customerName: string | null;
  customerType: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerLineId: string | null;
  preferredContact: string | null;
  language: string | null;
  autoLocatedCity: string | null;
  userEnteredCity: string | null;
  notes: string | null;
  branch: ManagerBranchRef | null;
  items: ManagerPendingAppointmentItem[];
  raw: JsonRecord;
};

const normalizeAppointmentItem = (
  value: unknown,
): ManagerPendingAppointmentItem | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const product = asRecord(row.product);

  return {
    id,
    productId: asNullableString(row.productId),
    fulfillmentStatus: asNullableString(row.fulfillmentStatus),
    requestedSource: asNullableString(row.requestedSource),
    product: product
      ? {
          id: asString(product.id),
          sku: asNullableString(product.sku),
          name: asNullableString(product.name),
          status: asNullableString(product.status),
        }
      : null,
    raw: row,
  };
};

const normalizePendingAppointment = (
  value: unknown,
): ManagerPendingAppointment | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const itemRows = Array.isArray(row.items)
    ? row.items
    : Array.isArray(row.appointmentItems)
      ? row.appointmentItems
      : [];

  const customer = asRecord(row.customer);

  return {
    id,
    status: asNullableString(row.status),
    appointmentDate: asNullableString(row.appointmentDate),
    branchId: asNullableString(row.branchId),
    salespersonUserId:
      asNullableString(row.salespersonUserId) ||
      asNullableString(row.assignedSalespersonUserId),
    customerName:
      asNullableString(row.name) ||
      asNullableString(row.customerName) ||
      asNullableString(customer?.name),
    customerType:
      asNullableString(row.customerType) || asNullableString(customer?.type),
      customerEmail:
        asNullableString(row.email) ||
        asNullableString(row.customerEmail) ||
        asNullableString(customer?.email),
      customerPhone:
        asNullableString(row.phone) ||
        asNullableString(row.customerPhone) ||
        asNullableString(customer?.phone),
      customerLineId:
        asNullableString(row.lineId) ||
        asNullableString(row.customerLineId) ||
        asNullableString(customer?.lineId),
      preferredContact: asNullableString(row.preferredContact),
      language:
        asNullableString(row.language) || asNullableString(customer?.language),
      autoLocatedCity:
        asNullableString(row.autoLocatedCity) ||
        asNullableString(row.autoLocation) ||
        asNullableString(customer?.location),
      userEnteredCity:
        asNullableString(row.userEnteredCity) ||
        asNullableString(row.customerCity) ||
        asNullableString(customer?.city),
      notes: asNullableString(row.notes),
      branch: normalizeManagerBranch(row.branch),
    items: itemRows
      .map((entry) => normalizeAppointmentItem(entry))
      .filter((entry): entry is ManagerPendingAppointmentItem => Boolean(entry)),
    raw: row,
  };
};

export const getManagerPendingAppointments = async ({
  accessToken,
  branchId,
}: {
  accessToken: string;
  branchId?: string;
}): Promise<ManagerPendingAppointment[]> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/appointments/pending${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load pending appointments.",
  });

  return extractRows(payload)
    .map((entry) => normalizePendingAppointment(entry))
    .filter((entry): entry is ManagerPendingAppointment => Boolean(entry));
};

export type ManagerAppointmentHistoryRecord = ManagerPendingAppointment & {
  assignedSalesperson: {
    id: string;
    displayName: string | null;
    user: {
      id: string;
      email: string | null;
      status: string | null;
    } | null;
  } | null;
  sales: Array<{
    id: string;
    productId: string | null;
    amount: number | null;
    currency: string | null;
    status: string | null;
    soldAt: string | null;
    salesperson: {
      id: string;
      displayName: string | null;
      user: {
        id: string;
        email: string | null;
      } | null;
    } | null;
  }>;
};

const normalizeManagerAppointmentHistoryRecord = (
  value: unknown,
): ManagerAppointmentHistoryRecord | null => {
  const base = normalizePendingAppointment(value);
  const row = asRecord(value);
  if (!base || !row) {
    return null;
  }

  const assignedSales = asRecord(row.assignedSales);
  const assignedSalesUser = asRecord(assignedSales?.user);
  const sales = Array.isArray(row.sales)
    ? row.sales
        .map((entry) => asRecord(entry))
        .map((sale) => {
          const id = asString(sale?.id);
          if (!id) {
            return null;
          }

          const salesperson = asRecord(sale?.salesperson);
          const salespersonUser = asRecord(salesperson?.user);
          return {
            id,
            productId: asNullableString(sale?.productId),
            amount: asFiniteNumberish(sale?.amount),
            currency: asNullableString(sale?.currency),
            status: asNullableString(sale?.status),
            soldAt: asNullableString(sale?.soldAt),
            salesperson: salesperson
              ? {
                  id: asString(salesperson.id),
                  displayName: asNullableString(salesperson.displayName),
                  user: salespersonUser
                    ? {
                        id: asString(salespersonUser.id),
                        email: asNullableString(salespersonUser.email),
                      }
                    : null,
                }
              : null,
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            id: string;
            productId: string | null;
            amount: number | null;
            currency: string | null;
            status: string | null;
            soldAt: string | null;
            salesperson: {
              id: string;
              displayName: string | null;
              user: {
                id: string;
                email: string | null;
              } | null;
            } | null;
          } => Boolean(entry),
        )
    : [];

  return {
    ...base,
    assignedSalesperson: assignedSales
      ? {
          id: asString(assignedSales.id),
          displayName: asNullableString(assignedSales.displayName),
          user: assignedSalesUser
            ? {
                id: asString(assignedSalesUser.id),
                email: asNullableString(assignedSalesUser.email),
                status: asNullableString(assignedSalesUser.status),
              }
            : null,
        }
      : null,
    sales,
  };
};

export const getManagerAppointments = async ({
  accessToken,
  branchId,
  status,
  limit,
}: {
  accessToken: string;
  branchId?: string;
  status?: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  limit?: number;
}): Promise<ManagerAppointmentHistoryRecord[]> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  if (status) {
    query.set("status", status);
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/appointments${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load appointments.",
  });

  return extractRows(payload)
    .map((entry) => normalizeManagerAppointmentHistoryRecord(entry))
    .filter((entry): entry is ManagerAppointmentHistoryRecord => Boolean(entry));
};

export type ManagerActionResponse = {
  statusCode: number;
  message: string | null;
  code: string | null;
  mode: string | null;
  branchId: string | null;
  targetUserId: string | null;
  status: string | null;
  statusAction: string | null;
  approvalRequest: JsonRecord | null;
  request: JsonRecord | null;
  executionResult: unknown;
  raw: unknown;
};

const normalizeManagerActionResponse = (
  statusCode: number,
  payload: unknown,
): ManagerActionResponse => {
  const root = asRecord(payload) ?? {};

  return {
    statusCode,
    message: asNullableString(root.message),
    code: asNullableString(root.code),
    mode: asNullableString(root.mode),
    branchId: asNullableString(root.branchId),
    targetUserId: asNullableString(root.targetUserId),
    status: asNullableString(root.status),
    statusAction: asNullableString(root.statusAction),
    approvalRequest: asRecord(root.approvalRequest),
    request: asRecord(root.request),
    executionResult: root.executionResult ?? null,
    raw: payload,
  };
};

export type ManagerBranchApprovalRequestUser = {
  id: string;
  email: string | null;
  role: string | null;
  status: string | null;
  raw: JsonRecord;
};

export type ManagerBranchApprovalRequestRecord = {
  id: string;
  actionType: string | null;
  status: string | null;
  targetUserId: string;
  requestedByUserId: string | null;
  reviewedByUserId: string | null;
  requestReason: string | null;
  decisionNote: string | null;
  requestPayload: JsonRecord | null;
  createdAt: string | null;
  updatedAt: string | null;
  decidedAt: string | null;
  targetUser: ManagerBranchApprovalRequestUser | null;
  requestedByUser: ManagerBranchApprovalRequestUser | null;
  reviewedByUser: ManagerBranchApprovalRequestUser | null;
  raw: JsonRecord;
};

export type ManagerBranchApprovalViewerScope =
  | "BRANCH_ADMIN"
  | "MANAGED_BRANCHES"
  | "SELF";

export type ManagerBranchApprovalRequestsResponse = {
  branchId: string | null;
  count: number;
  viewerScope: ManagerBranchApprovalViewerScope | null;
  canDecide: boolean;
  canViewAllManagedBranchRequests: boolean;
  records: ManagerBranchApprovalRequestRecord[];
  raw: unknown;
};

const normalizeManagerBranchApprovalRequestUser = (
  value: unknown,
): ManagerBranchApprovalRequestUser | null => {
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

const normalizeManagerBranchApprovalRequest = (
  value: unknown,
): ManagerBranchApprovalRequestRecord | null => {
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
    actionType: asNullableString(row.actionType),
    status: asNullableString(row.status),
    targetUserId,
    requestedByUserId: asNullableString(row.requestedByUserId),
    reviewedByUserId: asNullableString(row.reviewedByUserId),
    requestReason: asNullableString(row.requestReason),
    decisionNote: asNullableString(row.decisionNote),
    requestPayload: asRecord(row.requestPayload),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    decidedAt: asNullableString(row.decidedAt),
    targetUser: normalizeManagerBranchApprovalRequestUser(row.targetUser),
    requestedByUser: normalizeManagerBranchApprovalRequestUser(row.requestedByUser),
    reviewedByUser: normalizeManagerBranchApprovalRequestUser(row.reviewedByUser),
    raw: row,
  };
};

export const getManagerBranchApprovalRequests = async ({
  accessToken,
  branchId,
  status,
  limit,
}: {
  accessToken: string;
  branchId?: string;
  status?: string;
  limit?: number;
}): Promise<ManagerBranchApprovalRequestsResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  if (status) {
    query.set("status", asString(status).toUpperCase());
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/approval-requests${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load manager approval requests.",
  });

  const root = asRecord(payload) ?? {};
  const viewerScope = asString(root.viewerScope).toUpperCase();
  const records = extractRows(payload)
    .map((entry) => normalizeManagerBranchApprovalRequest(entry))
    .filter((entry): entry is ManagerBranchApprovalRequestRecord => Boolean(entry));

  return {
    branchId: asNullableString(root.branchId),
    count: asPositiveInt(root.count) ?? records.length,
    viewerScope:
      viewerScope === "BRANCH_ADMIN" ||
      viewerScope === "MANAGED_BRANCHES" ||
      viewerScope === "SELF"
        ? viewerScope
        : null,
    canDecide: asBoolean(root.canDecide),
    canViewAllManagedBranchRequests: asBoolean(root.canViewAllManagedBranchRequests),
    records,
    raw: payload,
  };
};

export const decideManagerBranchApprovalRequest = async ({
  accessToken,
  requestId,
  decision,
  decisionNote,
  doNotAskAgainForAction,
}: {
  accessToken: string;
  requestId: string;
  decision: "APPROVE" | "REJECT";
  decisionNote?: string;
  doNotAskAgainForAction?: boolean;
}): Promise<ManagerActionResponse> => {
  const body: Record<string, unknown> = {
    decision,
  };

  if (decisionNote !== undefined) {
    body.note = decisionNote;
  }
  if (doNotAskAgainForAction !== undefined) {
    body.doNotAskAgainForAction = doNotAskAgainForAction;
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/approval-requests/${encodeURIComponent(requestId)}/decision`,
    method: "PATCH",
    body,
    fallbackErrorMessage: "Failed to decide manager approval request.",
  });

  return normalizeManagerActionResponse(200, payload);
};

export const approveManagerAppointment = async ({
  accessToken,
  appointmentId,
  status,
  salespersonUserId,
  notes,
}: {
  accessToken: string;
  appointmentId: string;
  status?: "CONFIRMED" | "CANCELLED";
  salespersonUserId?: string;
  notes?: string;
}) => {
  const body: Record<string, unknown> = {};
  if (status) {
    body.status = status;
  }
  if (salespersonUserId) {
    body.salespersonUserId = salespersonUserId.trim();
  }
  if (notes) {
    body.notes = notes.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/appointments/${encodeURIComponent(appointmentId)}/approve`,
    method: "PATCH",
    body,
    fallbackErrorMessage: "Failed to update appointment status.",
  });

  return payload;
};

export const createManagerAppointmentPossession = async ({
  accessToken,
  appointmentId,
  productId,
  salespersonUserId,
  dueBackAt,
  note,
}: {
  accessToken: string;
  appointmentId: string;
  productId: string;
  salespersonUserId: string;
  dueBackAt?: string;
  note?: string;
}) => {
  const body: Record<string, unknown> = {
    productId: productId.trim(),
    salespersonUserId: salespersonUserId.trim(),
  };
  if (dueBackAt) {
    body.dueBackAt = dueBackAt;
  }
  if (note) {
    body.note = note.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/appointments/${encodeURIComponent(appointmentId)}/possessions`,
    method: "POST",
    body,
    fallbackErrorMessage: "Failed to create possession.",
  });

  return payload;
};

export const updateManagerSalespersonStatus = async ({
  accessToken,
  salespersonUserId,
  status,
  reason,
  branchId,
}: {
  accessToken: string;
  salespersonUserId: string;
  status: "ACTIVE" | "RESTRICTED" | "BANNED" | "TERMINATED";
  reason?: string;
  branchId?: string;
}): Promise<ManagerActionResponse> => {
  const body: Record<string, unknown> = {
    status,
  };
  if (reason) {
    body.reason = reason.trim();
  }
  if (branchId) {
    body.branchId = branchId.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/salespersons/${encodeURIComponent(salespersonUserId)}/status`,
    method: "PATCH",
    body,
    fallbackErrorMessage: "Failed to update salesperson status.",
  });

  return normalizeManagerActionResponse(200, payload);
};

export const updateManagerUserStatus = async ({
  accessToken,
  userId,
  status,
  reason,
  branchId,
}: {
  accessToken: string;
  userId: string;
  status: "ACTIVE" | "RESTRICTED" | "BANNED" | "TERMINATED";
  reason?: string;
  branchId?: string;
}): Promise<ManagerActionResponse> => {
  const body: Record<string, unknown> = {
    status,
  };
  if (reason) {
    body.reason = reason.trim();
  }
  if (branchId) {
    body.branchId = branchId.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/users/${encodeURIComponent(userId)}/status`,
    method: "PATCH",
    body,
    fallbackErrorMessage: "Failed to update user status.",
  });

  return normalizeManagerActionResponse(200, payload);
};

export const restrictManagerUser = async ({
  accessToken,
  userId,
  branchId,
  reason,
  note,
  startsAt,
  endsAt,
}: {
  accessToken: string;
  userId: string;
  branchId?: string;
  reason: string;
  note?: string | null;
  startsAt?: string;
  endsAt?: string;
}): Promise<ManagerActionResponse> => {
  const body: Record<string, unknown> = {
    reason: reason.trim(),
  };
  if (branchId) {
    body.branchId = branchId.trim();
  }
  if (note !== undefined) {
    body.note = note;
  }
  if (startsAt) {
    body.startsAt = startsAt;
  }
  if (endsAt) {
    body.endsAt = endsAt;
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/users/${encodeURIComponent(userId)}/restrictions`,
    method: "POST",
    body,
    fallbackErrorMessage: "Failed to restrict user.",
  });

  return normalizeManagerActionResponse(200, payload);
};

export const banManagerUser = async ({
  accessToken,
  userId,
  branchId,
  reason,
  note,
  startsAt,
  endsAt,
}: {
  accessToken: string;
  userId: string;
  branchId?: string;
  reason: string;
  note?: string | null;
  startsAt?: string;
  endsAt?: string;
}): Promise<ManagerActionResponse> => {
  const body: Record<string, unknown> = {
    reason: reason.trim(),
  };
  if (branchId) {
    body.branchId = branchId.trim();
  }
  if (note !== undefined) {
    body.note = note;
  }
  if (startsAt) {
    body.startsAt = startsAt;
  }
  if (endsAt) {
    body.endsAt = endsAt;
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/users/${encodeURIComponent(userId)}/ban`,
    method: "POST",
    body,
    fallbackErrorMessage: "Failed to ban user.",
  });

  return normalizeManagerActionResponse(200, payload);
};

export type ManagerSalespersonPerformance = {
  salespersonProfileId: string | null;
  displayName: string | null;
  branchIds: string[];
  salesTotalCount: number;
  salesTotalAmount: number;
  commissionsTotalCount: number;
  commissionsTotalAmount: number;
  appointmentsByStatus: Array<{
    status: string;
    count: number;
  }>;
  raw: unknown;
};

export const getManagerSalespersonPerformance = async ({
  accessToken,
  salespersonUserId,
  branchId,
}: {
  accessToken: string;
  salespersonUserId: string;
  branchId?: string;
}): Promise<ManagerSalespersonPerformance> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/salespersons/${encodeURIComponent(salespersonUserId)}/performance${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load salesperson performance.",
  });

  const root = asRecord(payload) ?? {};
  const sales = asRecord(root.sales) ?? {};
  const commissions = asRecord(root.commissions) ?? {};
  const appointmentsByStatus = Array.isArray(root.appointmentsByStatus)
    ? root.appointmentsByStatus
        .map((entry) => {
          const item = asRecord(entry);
          const status = asString(item?.status);
          if (!status) {
            return null;
          }

          const nestedCount = asRecord(item?._count);
          return {
            status,
            count:
              asPositiveInt(item?.count) ??
              asPositiveInt(nestedCount?._all) ??
              asPositiveInt(nestedCount?.count) ??
              0,
          };
        })
        .filter((entry): entry is { status: string; count: number } => Boolean(entry))
    : [];

  return {
    salespersonProfileId: asNullableString(root.salespersonProfileId),
    displayName: asNullableString(root.displayName),
    branchIds: Array.isArray(root.branchIds)
      ? root.branchIds.map((entry) => asString(entry)).filter(Boolean)
      : [],
    salesTotalCount: asPositiveInt(sales.totalCount) ?? 0,
    salesTotalAmount: asFiniteNumber(sales.totalAmount) ?? 0,
    commissionsTotalCount: asPositiveInt(commissions.totalCount) ?? 0,
    commissionsTotalAmount: asFiniteNumber(commissions.totalAmount) ?? 0,
    appointmentsByStatus,
    raw: payload,
  };
};

export type ManagerPossessionRecord = {
  id: string;
  possessionType: string | null;
  status: string | null;
  checkedOutAt: string | null;
  dueBackAt: string | null;
  returnedAt: string | null;
  note: string | null;
  branch: ManagerBranchRef | null;
  product: {
    id: string;
    sku: string | null;
    name: string | null;
    status: string | null;
    visibility: string | null;
  } | null;
  appointment: {
    id: string;
    status: string | null;
    appointmentDate: string | null;
    customerName: string | null;
  } | null;
  raw: JsonRecord;
};

const normalizeManagerPossession = (value: unknown): ManagerPossessionRecord | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const product = asRecord(row.product);
  const appointment = asRecord(row.appointment);

  return {
    id,
    possessionType: asNullableString(row.type),
    status: asNullableString(row.status),
    checkedOutAt: asNullableString(row.checkedOutAt),
    dueBackAt: asNullableString(row.dueBackAt),
    returnedAt: asNullableString(row.returnedAt),
    note: asNullableString(row.note),
    branch: normalizeManagerBranch(row.branch),
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
          status: asNullableString(appointment.status),
          appointmentDate: asNullableString(appointment.appointmentDate),
          customerName:
            asNullableString(appointment.name) ||
            asNullableString(appointment.customerName),
        }
      : null,
    raw: row,
  };
};

export const getManagerSalespersonPossessions = async ({
  accessToken,
  salespersonUserId,
  branchId,
}: {
  accessToken: string;
  salespersonUserId: string;
  branchId?: string;
}): Promise<ManagerPossessionRecord[]> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/salespersons/${encodeURIComponent(salespersonUserId)}/possessions${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load possessions.",
  });

  return extractRows(payload)
    .map((entry) => normalizeManagerPossession(entry))
    .filter((entry): entry is ManagerPossessionRecord => Boolean(entry));
};

export type ManagerInventoryRequestRecord = {
  id: string;
  status: string | null;
  fromLocation: string | null;
  branchId: string | null;
  productId: string | null;
  appointmentId: string | null;
  appointmentItemId: string | null;
  managerNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  raw: JsonRecord;
};

const normalizeManagerInventoryRequest = (
  value: unknown,
): ManagerInventoryRequestRecord | null => {
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
    status: asNullableString(row.status),
    fromLocation: asNullableString(row.fromLocation),
    branchId: asNullableString(row.branchId),
    productId: asNullableString(row.productId),
    appointmentId: asNullableString(row.appointmentId),
    appointmentItemId: asNullableString(row.appointmentItemId),
    managerNote: asNullableString(row.managerNote),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    raw: row,
  };
};

export const createManagerInventoryRequest = async ({
  accessToken,
  branchId,
  appointmentId,
  productId,
  appointmentItemId,
  fromLocation,
  managerNote,
}: {
  accessToken: string;
  branchId: string;
  appointmentId: string;
  productId: string;
  appointmentItemId?: string;
  fromLocation?: "MAIN" | "BRANCH_POOL";
  managerNote?: string;
}): Promise<ManagerInventoryRequestRecord | null> => {
  const body: Record<string, unknown> = {
    branchId: branchId.trim(),
    appointmentId: appointmentId.trim(),
    productId: productId.trim(),
  };

  if (appointmentItemId) {
    body.appointmentItemId = appointmentItemId.trim();
  }
  if (fromLocation) {
    body.fromLocation = fromLocation;
  }
  if (managerNote) {
    body.managerNote = managerNote.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: "/inventory-requests",
    method: "POST",
    body,
    fallbackErrorMessage: "Failed to create inventory request.",
  });

  const root = asRecord(payload);
  return (
    normalizeManagerInventoryRequest(payload) ||
    normalizeManagerInventoryRequest(root?.request) ||
    normalizeManagerInventoryRequest(root?.record)
  );
};

export type ManagerCommissionPolicyRecord = {
  id: string;
  branchId: string | null;
  salespersonUserId: string | null;
  salespersonId: string | null;
  rate: number | null;
  scope: string | null;
  productTier: string | null;
  productId: string | null;
  activeFrom: string | null;
  activeTo: string | null;
  isActive: boolean | null;
  priority: number | null;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  salesperson: {
    id: string;
    displayName: string | null;
    user: {
      id: string;
      email: string | null;
      status: string | null;
    } | null;
  } | null;
  product: {
    id: string;
    sku: string | null;
    name: string | null;
    visibility: string | null;
    status: string | null;
  } | null;
  createdByUser: {
    id: string;
    email: string | null;
    role: string | null;
  } | null;
  raw: JsonRecord;
};

const normalizeManagerCommissionPolicySalesperson = (
  value: unknown,
): ManagerCommissionPolicyRecord["salesperson"] => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const user = asRecord(row.user);
  const userId = asString(user?.id);

  return {
    id,
    displayName: asNullableString(row.displayName),
    user: userId
      ? {
          id: userId,
          email: asNullableString(user?.email),
          status: asNullableString(user?.status),
        }
      : null,
  };
};

const normalizeManagerCommissionPolicyProduct = (
  value: unknown,
): ManagerCommissionPolicyRecord["product"] => {
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
    sku: asNullableString(row.sku),
    name: asNullableString(row.name),
    visibility: asNullableString(row.visibility),
    status: asNullableString(row.status),
  };
};

const normalizeManagerCommissionPolicyCreatedByUser = (
  value: unknown,
): ManagerCommissionPolicyRecord["createdByUser"] => {
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
  };
};

const normalizeManagerCommissionPolicy = (
  value: unknown,
): ManagerCommissionPolicyRecord | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const salesperson = normalizeManagerCommissionPolicySalesperson(row.salesperson);
  const product = normalizeManagerCommissionPolicyProduct(row.product);
  const createdByUser = normalizeManagerCommissionPolicyCreatedByUser(
    row.createdByUser,
  );

  return {
    id,
    branchId: asNullableString(row.branchId),
    salespersonUserId:
      asNullableString(row.salespersonUserId) ||
      asNullableString(row.userId) ||
      salesperson?.user?.id ||
      null,
    salespersonId: asNullableString(row.salespersonId) || salesperson?.id || null,
    rate: asFiniteNumberish(row.rate),
    scope: asNullableString(row.scope),
    productTier: asNullableString(row.productTier),
    productId: asNullableString(row.productId) || product?.id || null,
    activeFrom: asNullableString(row.activeFrom),
    activeTo: asNullableString(row.activeTo),
    isActive: asNullableBoolean(row.isActive),
    priority: asFiniteNumberish(row.priority),
    note: asNullableString(row.note),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    salesperson,
    product,
    createdByUser,
    raw: row,
  };
};

export type ManagerCommissionPoliciesResponse = {
  branchId: string | null;
  count: number;
  records: ManagerCommissionPolicyRecord[];
  raw: unknown;
};

export const getManagerCommissionPolicies = async ({
  accessToken,
  branchId,
  limit,
  isActive,
  salespersonUserId,
  productId,
  productTier,
}: {
  accessToken: string;
  branchId?: string;
  limit?: number;
  isActive?: boolean;
  salespersonUserId?: string;
  productId?: string;
  productTier?: string;
}): Promise<ManagerCommissionPoliciesResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }
  if (isActive !== undefined) {
    query.set("isActive", String(isActive));
  }
  if (salespersonUserId) {
    query.set("salespersonUserId", salespersonUserId.trim());
  }
  if (productId) {
    query.set("productId", productId.trim());
  }
  if (productTier) {
    query.set("productTier", asString(productTier).toUpperCase());
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/commission-policies${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load commission policies.",
  });

  const root = asRecord(payload) ?? {};
  const records = extractRows(payload)
    .map((entry) => normalizeManagerCommissionPolicy(entry))
    .filter((entry): entry is ManagerCommissionPolicyRecord => Boolean(entry));

  return {
    branchId: asNullableString(root.branchId),
    count: asPositiveInt(root.count) ?? records.length,
    records,
    raw: payload,
  };
};

export const createManagerCommissionPolicy = async ({
  accessToken,
  branchId,
  salespersonUserId,
  rate,
  productTier,
  productId,
  activeFrom,
  activeTo,
  priority,
  note,
}: {
  accessToken: string;
  branchId: string;
  salespersonUserId: string;
  rate: number;
  productTier?: string;
  productId?: string;
  activeFrom?: string;
  activeTo?: string;
  priority?: number;
  note?: string;
}): Promise<ManagerCommissionPolicyRecord | null> => {
  const body: Record<string, unknown> = {
    branchId: branchId.trim(),
    salespersonUserId: salespersonUserId.trim(),
    rate,
  };

  if (productTier) {
    body.productTier = productTier;
  }
  if (productId) {
    body.productId = productId.trim();
  }
  if (activeFrom) {
    body.activeFrom = activeFrom;
  }
  if (activeTo) {
    body.activeTo = activeTo;
  }
  if (priority !== undefined) {
    body.priority = priority;
  }
  if (note) {
    body.note = note.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: "/commission-policies",
    method: "POST",
    body,
    fallbackErrorMessage: "Failed to create commission policy.",
  });

  const root = asRecord(payload);
  return (
    normalizeManagerCommissionPolicy(payload) ||
    normalizeManagerCommissionPolicy(root?.policy)
  );
};

export const updateManagerCommissionPolicy = async ({
  accessToken,
  policyId,
  salespersonUserId,
  rate,
  productTier,
  productId,
  activeFrom,
  activeTo,
  priority,
  note,
  isActive,
}: {
  accessToken: string;
  policyId: string;
  salespersonUserId?: string;
  rate?: number;
  productTier?: string | null;
  productId?: string | null;
  activeFrom?: string | null;
  activeTo?: string | null;
  priority?: number;
  note?: string | null;
  isActive?: boolean;
}): Promise<ManagerCommissionPolicyRecord | null> => {
  const body: Record<string, unknown> = {};

  if (salespersonUserId !== undefined) {
    body.salespersonUserId = salespersonUserId.trim();
  }
  if (rate !== undefined) {
    body.rate = rate;
  }
  if (productTier !== undefined) {
    body.productTier = productTier;
  }
  if (productId !== undefined) {
    body.productId = productId;
  }
  if (activeFrom !== undefined) {
    body.activeFrom = activeFrom;
  }
  if (activeTo !== undefined) {
    body.activeTo = activeTo;
  }
  if (priority !== undefined) {
    body.priority = priority;
  }
  if (note !== undefined) {
    body.note = note;
  }
  if (isActive !== undefined) {
    body.isActive = isActive;
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/commission-policies/${encodeURIComponent(policyId)}`,
    method: "PATCH",
    body,
    fallbackErrorMessage: "Failed to update commission policy.",
  });

  const root = asRecord(payload);
  return (
    normalizeManagerCommissionPolicy(payload) ||
    normalizeManagerCommissionPolicy(root?.policy)
  );
};

export type ManagerProductTargetingResult = {
  id: string;
  status: string | null;
  visibility: ManagerProductVisibility | null;
  minCustomerTier: CustomerTier | null;
  targetedUsersCount: number;
  updatedAt: string | null;
  raw: JsonRecord;
};

const normalizeManagerProductTargeting = (
  value: unknown,
): ManagerProductTargetingResult | null => {
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
    status: asNullableString(row.status),
    visibility: normalizeManagerProductVisibility(row.visibility),
    minCustomerTier: normalizeCustomerTier(row.minCustomerTier),
    targetedUsersCount: asPositiveInt(row.targetedUsersCount) ?? 0,
    updatedAt: asNullableString(row.updatedAt),
    raw: row,
  };
};

export type ManagerProductTargetingResponse = {
  message: string | null;
  code: string | null;
  targetedUsersCount: number;
  product: ManagerProductTargetingResult | null;
  requestedVisibility: {
    visibility: ManagerProductVisibility | null;
    minCustomerTier: CustomerTier | null;
    targetUserIds: string[];
    visibilityNote: string | null;
  } | null;
  approvalRequest: JsonRecord | null;
  raw: unknown;
};

export const updateManagerProductTargeting = async ({
  accessToken,
  productId,
  branchId,
  visibility,
  minCustomerTier,
  userIds,
  visibilityNote,
}: {
  accessToken: string;
  productId: string;
  branchId: string;
  visibility?: ManagerProductVisibility;
  minCustomerTier?: CustomerTier;
  userIds?: string[];
  visibilityNote?: string;
}): Promise<ManagerProductTargetingResponse> => {
  const body: Record<string, unknown> = {
    branchId: branchId.trim(),
  };
  if (visibility) {
    body.visibility = visibility;
  }
  if (minCustomerTier) {
    body.minCustomerTier = minCustomerTier;
  }
  if (Array.isArray(userIds)) {
    body.userIds = userIds.map((entry) => entry.trim()).filter(Boolean);
  }
  if (visibilityNote) {
    body.visibilityNote = visibilityNote.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/products/${encodeURIComponent(productId)}/targeting`,
    method: "PATCH",
    body,
    fallbackErrorMessage: "Failed to update product targeting.",
  });

  const root = asRecord(payload);
  const requestedVisibility = asRecord(root?.requestedVisibility);

  return {
    message: asNullableString(root?.message),
    code: asNullableString(root?.code),
    targetedUsersCount: asPositiveInt(root?.targetedUsersCount) ?? 0,
    product:
      normalizeManagerProductTargeting(payload) ||
      normalizeManagerProductTargeting(root?.product),
    requestedVisibility: requestedVisibility
      ? {
          visibility: normalizeManagerProductVisibility(requestedVisibility.visibility),
          minCustomerTier: normalizeCustomerTier(requestedVisibility.minCustomerTier),
          targetUserIds: Array.isArray(requestedVisibility.targetUserIds)
            ? requestedVisibility.targetUserIds.map((entry) => asString(entry)).filter(Boolean)
            : [],
          visibilityNote: asNullableString(requestedVisibility.visibilityNote),
        }
      : null,
    approvalRequest: asRecord(root?.approvalRequest),
    raw: payload,
  };
};

export type ManagerProductMediaVisibilityResponse = {
  message: string | null;
  code: string | null;
  branchId: string | null;
  media: ManagerProductMediaReference | null;
  raw: unknown;
};

export const updateManagerProductMediaVisibility = async ({
  accessToken,
  productId,
  mediaId,
  branchId,
  visibilityPreset,
  minCustomerTier,
  userIds,
}: {
  accessToken: string;
  productId: string;
  mediaId: string;
  branchId?: string;
  visibilityPreset?: MediaVisibilityPreset;
  minCustomerTier?: CustomerTier;
  userIds?: string[];
}): Promise<ManagerProductMediaVisibilityResponse> => {
  const body: Record<string, unknown> = {};

  if (branchId) {
    body.branchId = branchId.trim();
  }
  if (visibilityPreset) {
    body.visibilityPreset = visibilityPreset;
  }
  if (minCustomerTier) {
    body.minCustomerTier = minCustomerTier;
  }
  if (Array.isArray(userIds)) {
    body.userIds = userIds.map((entry) => entry.trim()).filter(Boolean);
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}/visibility`,
    method: "PATCH",
    body,
    fallbackErrorMessage: "Failed to update product media visibility.",
  });

  const root = asRecord(payload) ?? {};

  return {
    message: asNullableString(root.message),
    code: asNullableString(root.code),
    branchId: asNullableString(root.branchId),
    media: normalizeManagerProductMedia(root.media),
    raw: payload,
  };
};

export type ManagerBranchProductRequestRecord = {
  id: string;
  status: string | null;
  branch: ManagerBranchRef | null;
  requestedProducts: Array<{
    id: string;
    sku: string | null;
    name: string | null;
    saleRangeMin: number | null;
    saleRangeMax: number | null;
    raw: JsonRecord;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
  raw: JsonRecord;
};

export type ManagerBranchProductRequestsResponse = {
  count: number;
  records: ManagerBranchProductRequestRecord[];
  raw: unknown;
};

const normalizeRequestedProduct = (value: unknown) => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const saleRange = asRecord(row.saleRange);

  return {
    id,
    sku: asNullableString(row.sku),
    name: asNullableString(row.name),
    saleRangeMin: asFiniteNumber(saleRange?.min),
    saleRangeMax: asFiniteNumber(saleRange?.max),
    raw: row,
  };
};

const normalizeBranchProductRequest = (
  value: unknown,
): ManagerBranchProductRequestRecord | null => {
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
    status: asNullableString(row.status),
    branch: normalizeManagerBranch(row.branch),
    requestedProducts: Array.isArray(row.requestedProducts)
      ? row.requestedProducts
          .map((entry) => normalizeRequestedProduct(entry))
          .filter(
            (
              entry,
            ): entry is {
              id: string;
              sku: string | null;
              name: string | null;
              saleRangeMin: number | null;
              saleRangeMax: number | null;
              raw: JsonRecord;
            } => Boolean(entry),
          )
      : [],
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    raw: row,
  };
};

export const getManagerBranchProductRequests = async ({
  accessToken,
  branchId,
  status,
  limit,
}: {
  accessToken: string;
  branchId?: string;
  status?: string;
  limit?: number;
}): Promise<ManagerBranchProductRequestsResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  if (status) {
    query.set("status", asString(status).toUpperCase());
  }
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: `/branch-products/requests${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load branch product requests.",
  });

  const root = asRecord(payload) ?? {};
  const records = extractRows(payload)
    .map((entry) => normalizeBranchProductRequest(entry))
    .filter((entry): entry is ManagerBranchProductRequestRecord => Boolean(entry));

  return {
    count: asPositiveInt(root.count) ?? records.length,
    records,
    raw: payload,
  };
};

export const createManagerBranchProductRequest = async ({
  accessToken,
  branchId,
  productIds,
  requestedCommissionRate,
  note,
}: {
  accessToken: string;
  branchId?: string;
  productIds: string[];
  requestedCommissionRate?: number;
  note?: string;
}): Promise<ManagerActionResponse> => {
  const body: Record<string, unknown> = {
    productIds: productIds.map((entry) => entry.trim()).filter(Boolean),
  };
  if (branchId) {
    body.branchId = branchId.trim();
  }
  if (requestedCommissionRate !== undefined) {
    body.requestedCommissionRate = requestedCommissionRate;
  }
  if (note) {
    body.note = note.trim();
  }

  const payload = await fetchManagerJson({
    accessToken,
    path: "/branch-products",
    method: "POST",
    body,
    fallbackErrorMessage: "Failed to submit branch product request.",
  });

  return normalizeManagerActionResponse(201, payload);
};

export type ManagerProductTotalValueResponse = {
  branchId: string | null;
  valueSource: string | null;
  selectedCount: number;
  totalValue: number;
  branchAdminCommissionRate: number | null;
  branchAdminCommissionAmount: number;
  valueAfterBranchAdminCommission: number;
  products: Array<{
    id: string;
    sku: string | null;
    name: string | null;
    status: string | null;
    selectedValue: number | null;
    raw: JsonRecord;
  }>;
  raw: unknown;
};

export const getManagerDashboardProductsTotalValue = async ({
  accessToken,
  branchId,
  valueSource,
  productIds,
}: {
  accessToken: string;
  branchId?: string;
  valueSource?: "SALE_MAX" | "SALE_MIN" | "BUY";
  productIds?: string[];
}): Promise<ManagerProductTotalValueResponse> => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }
  if (valueSource) {
    query.set("valueSource", valueSource);
  }
  setCsvQuery(query, "productIds", productIds);

  const payload = await fetchManagerJson({
    accessToken,
    path: `/dashboard/products/total-value${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load product total value.",
  });

  const root = asRecord(payload) ?? {};
  const products = extractRows(payload)
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) {
        return null;
      }

      const id = asString(row.id);
      if (!id) {
        return null;
      }

      return {
        id,
        sku: asNullableString(row.sku),
        name: asNullableString(row.name),
        status: asNullableString(row.status),
        selectedValue: asFiniteNumber(row.selectedValue),
        raw: row,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        id: string;
        sku: string | null;
        name: string | null;
        status: string | null;
        selectedValue: number | null;
        raw: JsonRecord;
      } => Boolean(entry),
    );

  return {
    branchId: asNullableString(root.branchId),
    valueSource: asNullableString(root.valueSource),
    selectedCount: asPositiveInt(root.selectedCount) ?? products.length,
    totalValue: asFiniteNumber(root.totalValue) ?? 0,
    branchAdminCommissionRate: asFiniteNumber(root.branchAdminCommissionRate),
    branchAdminCommissionAmount: asFiniteNumber(root.branchAdminCommissionAmount) ?? 0,
    valueAfterBranchAdminCommission:
      asFiniteNumber(root.valueAfterBranchAdminCommission) ?? 0,
    products,
    raw: payload,
  };
};
