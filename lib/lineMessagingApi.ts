"use client";

import { API_BASE_PATH, ApiClientError } from "./apiClient";

type JsonRecord = Record<string, unknown>;

type StaffRole = "manager" | "salesperson";

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

const rolePath = (role: StaffRole, path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_PATH}/${role}${normalized}`;
};

const fetchRoleJson = async ({
  accessToken,
  role,
  path,
  method = "GET",
  body,
  fallbackErrorMessage,
}: {
  accessToken: string;
  role: StaffRole;
  path: string;
  method?: "GET" | "POST";
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

  const response = await fetch(rolePath(role, path), {
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

export type StaffLineConversation = {
  id: string;
  appointmentId: string | null;
  branchId: string | null;
  status: string | null;
  sessionEndedAt: string | null;
  sessionGraceEndsAt: string | null;
  customerUserId: string | null;
  customerLineUserId: string | null;
  customerLineDisplayName: string | null;
  customerLinePictureUrl: string | null;
  customerDisplayName: string | null;
  customerEmail: string | null;
  createdByUserId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageId: string | null;
  lastMessageSenderType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  branch: {
    id: string;
    code: string | null;
    name: string | null;
    city: string | null;
  } | null;
  assignedSalesperson: {
    profileId: string;
    userId: string | null;
    displayName: string | null;
    email: string | null;
  } | null;
  appointment: {
    id: string;
    status: string | null;
    preferredContact: string | null;
    appointmentDate: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerLineId: string | null;
    notes: string | null;
    previewImageUrl: string | null;
    items: Array<{
      id: string;
      productId: string | null;
      product: {
        id: string;
        sku: string | null;
        name: string | null;
        previewImageUrl: string | null;
      } | null;
    }>;
  } | null;
  raw: JsonRecord;
};

export type LineConversationSummary = StaffLineConversation;

export type StaffLineMessage = {
  id: string;
  conversationId: string | null;
  senderType: string | null;
  senderUserId: string | null;
  senderDisplayName: string | null;
  senderLineUserId: string | null;
  text: string;
  lineMessageId: string | null;
  webhookEventId: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  raw: JsonRecord;
};

export type LineMessageRecord = StaffLineMessage;

const normalizeConversation = (value: unknown): StaffLineConversation | null => {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const id = asString(row.id);
  if (!id) {
    return null;
  }

  const branch = asRecord(row.branch);
  const assignedSalesperson = asRecord(row.assignedSalesperson);
  const appointment = asRecord(row.appointment);
  const appointmentItems = Array.isArray(appointment?.items) ? appointment.items : [];

  return {
    id,
    appointmentId: asNullableString(row.appointmentId),
    branchId: asNullableString(row.branchId),
    status: asNullableString(row.status),
    sessionEndedAt: asNullableString(row.sessionEndedAt),
    sessionGraceEndsAt: asNullableString(row.sessionGraceEndsAt),
    customerUserId: asNullableString(row.customerUserId),
    customerLineUserId: asNullableString(row.customerLineUserId),
    customerLineDisplayName: asNullableString(row.customerLineDisplayName),
    customerLinePictureUrl: asNullableString(row.customerLinePictureUrl),
    customerDisplayName: asNullableString(row.customerDisplayName),
    customerEmail: asNullableString(row.customerEmail),
    createdByUserId: asNullableString(row.createdByUserId),
    lastMessageAt: asNullableString(row.lastMessageAt),
    lastMessagePreview: asNullableString(row.lastMessagePreview),
    lastMessageId: asNullableString(row.lastMessageId),
    lastMessageSenderType: asNullableString(row.lastMessageSenderType),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
    branch: branch
      ? {
          id: asString(branch.id),
          code: asNullableString(branch.code),
          name: asNullableString(branch.name),
          city: asNullableString(branch.city),
        }
      : null,
    assignedSalesperson:
      assignedSalesperson && asString(assignedSalesperson.profileId)
        ? {
            profileId: asString(assignedSalesperson.profileId),
            userId: asNullableString(assignedSalesperson.userId),
            displayName: asNullableString(assignedSalesperson.displayName),
            email: asNullableString(assignedSalesperson.email),
          }
        : null,
    appointment:
      appointment && asString(appointment.id)
        ? {
            id: asString(appointment.id),
            status: asNullableString(appointment.status),
            preferredContact: asNullableString(appointment.preferredContact),
            appointmentDate: asNullableString(appointment.appointmentDate),
            customerName: asNullableString(appointment.customerName),
            customerEmail: asNullableString(appointment.customerEmail),
            customerLineId: asNullableString(appointment.customerLineId),
            notes: asNullableString(appointment.notes),
            previewImageUrl: asNullableString(appointment.previewImageUrl),
            items: appointmentItems
              .map((entry) => {
                const item = asRecord(entry);
                if (!item) {
                  return null;
                }

                const itemId = asString(item.id);
                if (!itemId) {
                  return null;
                }

                const product = asRecord(item.product);
                return {
                  id: itemId,
                  productId: asNullableString(item.productId),
                  product:
                    product && asString(product.id)
                      ? {
                          id: asString(product.id),
                          sku: asNullableString(product.sku),
                          name: asNullableString(product.name),
                          previewImageUrl: asNullableString(product.previewImageUrl),
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
                  product: {
                    id: string;
                    sku: string | null;
                    name: string | null;
                    previewImageUrl: string | null;
                  } | null;
                } => Boolean(entry),
              ),
          }
        : null,
    raw: row,
  };
};

const normalizeMessage = (value: unknown): StaffLineMessage | null => {
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
    conversationId: asNullableString(row.conversationId),
    senderType: asNullableString(row.senderType),
    senderUserId: asNullableString(row.senderUserId),
    senderDisplayName: asNullableString(row.senderDisplayName),
    senderLineUserId: asNullableString(row.senderLineUserId),
    text: asString(row.text),
    lineMessageId: asNullableString(row.lineMessageId),
    webhookEventId: asNullableString(row.webhookEventId),
    deliveredAt: asNullableString(row.deliveredAt),
    createdAt: asNullableString(row.createdAt),
    raw: row,
  };
};

export const getRoleLineConversations = async ({
  accessToken,
  role,
  branchId,
}: {
  accessToken: string;
  role: StaffRole;
  branchId?: string;
}) => {
  const query = new URLSearchParams();
  if (branchId) {
    query.set("branchId", branchId.trim());
  }

  const payload = await fetchRoleJson({
    accessToken,
    role,
    path: `/line/conversations${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load LINE conversations.",
  });

  const root = asRecord(payload) ?? {};
  const records = (Array.isArray(root.records) ? root.records : [])
    .map((entry) => normalizeConversation(entry))
    .filter((entry): entry is StaffLineConversation => Boolean(entry));

  return {
    count: asPositiveInt(root.count) ?? records.length,
    records,
    raw: payload,
  };
};

export const getStaffLineConversations = getRoleLineConversations;

export const getRoleLineConversationMessages = async ({
  accessToken,
  role,
  conversationId,
  limit,
}: {
  accessToken: string;
  role: StaffRole;
  conversationId: string;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (limit && limit > 0) {
    query.set("limit", String(limit));
  }

  const payload = await fetchRoleJson({
    accessToken,
    role,
    path: `/line/conversations/${encodeURIComponent(conversationId)}/messages${query.toString() ? `?${query.toString()}` : ""}`,
    method: "GET",
    fallbackErrorMessage: "Failed to load LINE messages.",
  });

  const root = asRecord(payload) ?? {};
  const records = (Array.isArray(root.records) ? root.records : [])
    .map((entry) => normalizeMessage(entry))
    .filter((entry): entry is StaffLineMessage => Boolean(entry));

  return {
    count: asPositiveInt(root.count) ?? records.length,
    conversation: normalizeConversation(root.conversation),
    records,
    raw: payload,
  };
};

export const getStaffLineMessages = getRoleLineConversationMessages;

export const sendRoleLineMessage = async ({
  accessToken,
  role,
  conversationId,
  text,
}: {
  accessToken: string;
  role: StaffRole;
  conversationId: string;
  text: string;
}) => {
  const payload = await fetchRoleJson({
    accessToken,
    role,
    path: `/line/conversations/${encodeURIComponent(conversationId)}/messages`,
    method: "POST",
    body: { text },
    fallbackErrorMessage: "Failed to send LINE message.",
  });

  const root = asRecord(payload) ?? {};
  return {
    conversation: normalizeConversation(root.conversation),
    message: normalizeMessage(root.message),
    raw: payload,
  };
};

export const sendStaffLineMessage = sendRoleLineMessage;

export const endRoleLineSession = async ({
  accessToken,
  role,
  conversationId,
}: {
  accessToken: string;
  role: StaffRole;
  conversationId: string;
}) => {
  const payload = await fetchRoleJson({
    accessToken,
    role,
    path: `/line/conversations/${encodeURIComponent(conversationId)}/end-session`,
    method: "POST",
    fallbackErrorMessage: "Failed to end LINE session.",
  });

  const root = asRecord(payload) ?? {};
  return {
    conversation: normalizeConversation(root.conversation),
    message: normalizeMessage(root.message),
    raw: payload,
  };
};

export const endStaffLineSession = endRoleLineSession;

export const getRealtimeSocketOrigin = () => {
  const configured = (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    ""
  ).trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "";
};

export const resolveRealtimeApiOrigin = getRealtimeSocketOrigin;
export const normalizeLineConversationPayload = normalizeConversation;
export const normalizeLineMessagePayload = normalizeMessage;
