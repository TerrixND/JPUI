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

const salespersonPath = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_PATH}/salesperson${normalized}`;
};

const fetchSalespersonJson = async ({
  accessToken,
  path,
  method = "GET",
  body,
  fallbackErrorMessage,
}: {
  accessToken: string;
  path: string;
  method?: "GET" | "PATCH";
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

  const response = await fetch(salespersonPath(path), {
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

type SalespersonBranchRef = {
  id: string;
  code: string | null;
  name: string | null;
};

export type SalespersonAppointmentItem = {
  id: string;
  productId: string | null;
  fulfillmentStatus: string | null;
  raw: JsonRecord;
};

export type SalespersonAppointmentRecord = {
  id: string;
  status: string | null;
  appointmentDate: string | null;
  branchId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerLineId: string | null;
  preferredContact: string | null;
  notes: string | null;
  branch: SalespersonBranchRef | null;
  items: SalespersonAppointmentItem[];
  sales: Array<{
    id: string;
    status: string | null;
    soldAt: string | null;
    amount: number | null;
    currency: string | null;
  }>;
  raw: JsonRecord;
};

export type SalespersonAppointmentStatus =
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type SalespersonAppointmentUpdateResponse = {
  appointment: SalespersonAppointmentRecord | null;
  lineConversationId: string | null;
  raw: unknown;
};

const normalizeBranch = (value: unknown): SalespersonBranchRef | null => {
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
  };
};

const normalizeAppointmentItem = (
  value: unknown,
): SalespersonAppointmentItem | null => {
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
    productId: asNullableString(row.productId),
    fulfillmentStatus: asNullableString(row.fulfillmentStatus),
    raw: row,
  };
};

const normalizeAppointment = (
  value: unknown,
): SalespersonAppointmentRecord | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const items = Array.isArray(row.items) ? row.items : [];
  const sales = Array.isArray(row.sales) ? row.sales : [];

  return {
    id,
    status: asNullableString(row.status),
    appointmentDate: asNullableString(row.appointmentDate),
    branchId: asNullableString(row.branchId),
    customerName: asNullableString(row.name),
    customerEmail: asNullableString(row.email),
    customerPhone: asNullableString(row.phone),
    customerLineId: asNullableString(row.lineId),
    preferredContact: asNullableString(row.preferredContact),
    notes: asNullableString(row.notes),
    branch: normalizeBranch(row.branch),
    items: items
      .map((entry) => normalizeAppointmentItem(entry))
      .filter((entry): entry is SalespersonAppointmentItem => Boolean(entry)),
    sales: sales
      .map((entry) => asRecord(entry))
      .map((sale) => {
        const id = asString(sale?.id);
        if (!id) {
          return null;
        }

        return {
          id,
          status: asNullableString(sale?.status),
          soldAt: asNullableString(sale?.soldAt),
          amount:
            typeof sale?.amount === "number"
              ? sale.amount
              : typeof sale?.amount === "string"
                ? Number(sale.amount)
                : null,
          currency: asNullableString(sale?.currency),
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          id: string;
          status: string | null;
          soldAt: string | null;
          amount: number | null;
          currency: string | null;
        } => Boolean(entry),
      ),
    raw: row,
  };
};

const extractAppointmentRows = (payload: unknown) => {
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

  if (Array.isArray(root.appointments)) {
    return root.appointments;
  }

  if (Array.isArray(root.items)) {
    return root.items;
  }

  return [];
};

export const getSalespersonAppointments = async ({
  accessToken,
}: {
  accessToken: string;
}): Promise<SalespersonAppointmentRecord[]> => {
  const payload = await fetchSalespersonJson({
    accessToken,
    path: "/me/appointments",
    method: "GET",
    fallbackErrorMessage: "Failed to load salesperson appointments.",
  });

  return extractAppointmentRows(payload)
    .map((entry) => normalizeAppointment(entry))
    .filter((entry): entry is SalespersonAppointmentRecord => Boolean(entry));
};

export const updateSalespersonAppointmentStatus = async ({
  accessToken,
  appointmentId,
  status,
}: {
  accessToken: string;
  appointmentId: string;
  status: SalespersonAppointmentStatus;
}): Promise<SalespersonAppointmentUpdateResponse> => {
  const payload = await fetchSalespersonJson({
    accessToken,
    path: `/me/appointments/${encodeURIComponent(appointmentId)}/status`,
    method: "PATCH",
    body: { status },
    fallbackErrorMessage: "Failed to update salesperson appointment status.",
  });

  const root = asRecord(payload);
  const lineConversation = asRecord(root?.lineConversation);

  return {
    appointment: normalizeAppointment(payload),
    lineConversationId: asNullableString(lineConversation?.id),
    raw: payload,
  };
};
