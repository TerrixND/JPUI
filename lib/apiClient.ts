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
  expiresAt: string | null;
};

export type MediaRecord = {
  id: string;
  productId: string | null;
  type: MediaType | string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
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
  type: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string;
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

export type StaffOnboardingRule = {
  id: string;
  role: string;
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
  setAsPrimaryManager?: boolean;
  expiresAt?: string | null;
};

export type AdminLogBackupsResponse = {
  files: AdminLogBackupFile[];
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

const asPositiveInt = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.floor(parsed);
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

const fetchJson = async ({
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
}) => {
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

    throw new ApiClientError({
      message: `${responseMessage} [HTTP ${response.status}]`,
      status: response.status,
      code: asNullableString(errorPayload?.code),
      reason: asNullableString(errorPayload?.reason),
      payload,
    });
  }

  return payload;
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
    type: asString(candidate.type).toUpperCase(),
    mimeType,
    sizeBytes,
    url,
    createdAt,
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
  | "type"
  | "mimeType"
  | "sizeBytes"
  | "url"
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
    url,
    type: asNullableString(root.type),
    mimeType: asNullableString(root.mimeType),
    sizeBytes: asFiniteNumber(root.sizeBytes),
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

export const mapPageContextToMediaSection = (context: MediaPageContext): MediaSection =>
  mediaSectionByPageContext[context];

export const createMediaPresign = async ({
  accessToken,
  contentType,
  sizeBytes,
  productId,
}: {
  accessToken: string;
  contentType: string;
  sizeBytes: number;
  productId?: string;
}): Promise<MediaPresignResponse> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/media/presign`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contentType,
      sizeBytes,
      ...(productId ? { productId } : {}),
    }),
    fallbackErrorMessage: "Failed to request media upload URL.",
  });

  const root = asRecord(payload);
  const uploadUrl = asString(root?.uploadUrl);
  const key = asString(root?.key);

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
    expiresAt: asNullableString(root?.expiresAt),
  };
};

export const uploadFileToPresignedUrl = async ({
  uploadUrl,
  file,
  contentType,
}: {
  uploadUrl: string;
  file: File;
  contentType: string;
}) => {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
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
  visibilitySections,
  audience,
  visibilityPreset,
  allowedRoles,
  minCustomerTier,
  targetUserIds,
}: {
  accessToken: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  productId?: string;
  visibilitySections?: MediaSection[];
  audience?: MediaAudience;
  visibilityPreset?: MediaVisibilityPreset;
  allowedRoles?: MediaRole[];
  minCustomerTier?: CustomerTier;
  targetUserIds?: string[];
}): Promise<MediaRecord> => {
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/media`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      mimeType,
      sizeBytes,
      ...(productId ? { productId } : {}),
      ...(visibilitySections?.length ? { visibilitySections } : {}),
      ...(audience ? { audience } : {}),
      ...(visibilityPreset ? { visibilityPreset } : {}),
      ...(allowedRoles?.length ? { allowedRoles } : {}),
      ...(minCustomerTier ? { minCustomerTier } : {}),
      ...(targetUserIds?.length ? { targetUserIds } : {}),
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
    productId: asNullableString(root?.productId),
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

const normalizeStaffRule = (rawRow: unknown): StaffOnboardingRule | null => {
  const row = asRecord(rawRow);
  if (!row) return null;

  const id = asString(row.id);
  const role = asString(row.role);
  if (!id || !role) return null;

  return {
    id,
    role,
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

export const getAdminStaffRules = async ({
  accessToken,
  status,
  limit,
}: {
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
  const payload = await fetchJson({
    path: `${API_BASE_PATH}/admin/staff-onboarding/rules${queryString ? `?${queryString}` : ""}`,
    method: "GET",
    accessToken,
    fallbackErrorMessage: "Failed to load staff onboarding rules.",
  });

  return extractStaffRules(payload)
    .map((row) => normalizeStaffRule(row))
    .filter((row): row is StaffOnboardingRule => Boolean(row));
};

export const createAdminStaffRule = async ({
  accessToken,
  payload,
}: {
  accessToken: string;
  payload: CreateStaffRulePayload;
}): Promise<StaffOnboardingRule> => {
  const body: Record<string, unknown> = {
    role: payload.role,
    email: payload.email,
    phone: payload.phone,
  };

  if (payload.displayName) body.displayName = payload.displayName;
  if (payload.lineId) body.lineId = payload.lineId;
  if (payload.note) body.note = payload.note;
  if (payload.branchId) body.branchId = payload.branchId;
  if (payload.setAsPrimaryManager !== undefined) body.setAsPrimaryManager = payload.setAsPrimaryManager;
  if (payload.expiresAt) body.expiresAt = payload.expiresAt;

  const responsePayload = await fetchJson({
    path: `${API_BASE_PATH}/admin/staff-onboarding/rules`,
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

export const revokeAdminStaffRule = async ({
  accessToken,
  ruleId,
}: {
  accessToken: string;
  ruleId: string;
}): Promise<StaffOnboardingRule> => {
  const responsePayload = await fetchJson({
    path: `${API_BASE_PATH}/admin/staff-onboarding/rules/${encodeURIComponent(ruleId)}/revoke`,
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
