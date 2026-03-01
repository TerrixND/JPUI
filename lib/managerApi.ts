import { API_BASE_PATH, ApiClientError } from "./apiClient";

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

const asBoolean = (value: unknown) => value === true;

const asPositiveInt = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.floor(numeric);
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

export type ManagerProductSummary = {
  id: string;
  sku: string | null;
  name: string | null;
  tier: string | null;
  status: string | null;
  visibility: string | null;
  saleRangeMin: number | null;
  saleRangeMax: number | null;
  isSelectedForBranch: boolean;
  branchCommissionRate: number | null;
  projectedBranchCommissionMin: number | null;
  projectedBranchCommissionMax: number | null;
  selectedValue: number | null;
  targetedUsersCount: number;
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

  return {
    id,
    sku: asNullableString(row.sku),
    name: asNullableString(row.name),
    tier: asNullableString(row.tier),
    status: asNullableString(row.status),
    visibility: asNullableString(row.visibility),
    saleRangeMin: asFiniteNumber(saleRange?.min),
    saleRangeMax: asFiniteNumber(saleRange?.max),
    isSelectedForBranch: asBoolean(row.isSelectedForBranch),
    branchCommissionRate: asFiniteNumber(row.branchCommissionRate),
    projectedBranchCommissionMin: asFiniteNumber(projectedRange?.min),
    projectedBranchCommissionMax: asFiniteNumber(projectedRange?.max),
    selectedValue: asFiniteNumber(row.selectedValue),
    targetedUsersCount: asPositiveInt(row.targetedUsersCount) ?? 0,
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
  rate: number | null;
  productTier: string | null;
  productId: string | null;
  activeFrom: string | null;
  activeTo: string | null;
  priority: number | null;
  note: string | null;
  raw: JsonRecord;
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

  return {
    id,
    branchId: asNullableString(row.branchId),
    salespersonUserId:
      asNullableString(row.salespersonUserId) || asNullableString(row.userId),
    rate: asFiniteNumber(row.rate),
    productTier: asNullableString(row.productTier),
    productId: asNullableString(row.productId),
    activeFrom: asNullableString(row.activeFrom),
    activeTo: asNullableString(row.activeTo),
    priority: asFiniteNumber(row.priority),
    note: asNullableString(row.note),
    raw: row,
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

export type ManagerProductTargetingResult = {
  id: string;
  status: string | null;
  visibility: string | null;
  minCustomerTier: string | null;
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
    visibility: asNullableString(row.visibility),
    minCustomerTier: asNullableString(row.minCustomerTier),
    targetedUsersCount: asPositiveInt(row.targetedUsersCount) ?? 0,
    updatedAt: asNullableString(row.updatedAt),
    raw: row,
  };
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
  visibility?: "PRIVATE" | "PUBLIC" | "TOP_SHELF" | "TARGETED";
  minCustomerTier?: "REGULAR" | "VIP" | "ULTRA_VIP";
  userIds?: string[];
  visibilityNote?: string;
}): Promise<ManagerProductTargetingResult | null> => {
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
  return (
    normalizeManagerProductTargeting(payload) ||
    normalizeManagerProductTargeting(root?.product)
  );
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
