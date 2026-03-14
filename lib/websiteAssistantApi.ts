import supabase from "@/lib/supabase";

const WEBSITE_ASSISTANT_ENDPOINT = "/api/v1/ai/chat";
const DEFAULT_HANDOFF_COMMAND = "/support en";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const asNullableString = (value: unknown) => {
  const normalized = asString(value).trim();
  return normalized || null;
};

const parseJsonSafely = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const buildErrorMessage = (payload: unknown, fallbackMessage: string) => {
  if (isRecord(payload)) {
    const message = asString(payload.message).trim();
    if (message) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  return fallbackMessage;
};

const asNumberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSuggestedFollowUps = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(
        value
          .map((entry) => asString(entry).trim())
          .filter(Boolean),
      )].slice(0, 4)
    : [];

export type WebsiteAssistantProductResultItem = {
  id: string;
  name: string;
  shortDescription: string;
  mediaPreviewUrl: string | null;
  productRoute: string | null;
  productType: string | null;
  shape: string | null;
  color: string | null;
  weightCarat: number | null;
  weightGram: number | null;
  hasCertificate: boolean;
};

export type WebsiteAssistantUi =
  | {
      type: "product_results";
      items: WebsiteAssistantProductResultItem[];
    }
  | {
      type: "none";
      items: [];
    };

export type WebsiteAssistantActionType =
  | "OPEN_ROUTE"
  | "START_LINE_CONNECT"
  | "ESCALATE_SUPPORT"
  | "OPEN_PRODUCT"
  | "OPEN_SUPPORT_PAGE"
  | "OPEN_CONTACT_PAGE"
  | "NONE";

export type WebsiteAssistantAction = {
  type: WebsiteAssistantActionType;
  route: string | null;
  productRoute: string | null;
  label: string | null;
  handoffCommand: string | null;
};

const normalizeProductResultItem = (
  value: unknown,
): WebsiteAssistantProductResultItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id).trim();
  const name = asString(value.name).trim();

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    shortDescription: asString(value.shortDescription).trim(),
    mediaPreviewUrl: asNullableString(value.mediaPreviewUrl),
    productRoute: asNullableString(value.productRoute),
    productType: asNullableString(value.productType),
    shape: asNullableString(value.shape),
    color: asNullableString(value.color),
    weightCarat: asNumberOrNull(value.weightCarat),
    weightGram: asNumberOrNull(value.weightGram),
    hasCertificate: value.hasCertificate === true,
  };
};

const normalizeUi = (value: unknown): WebsiteAssistantUi => {
  if (!isRecord(value)) {
    return {
      type: "none",
      items: [],
    };
  }

  const type = asString(value.type).trim().toLowerCase();
  const items = Array.isArray(value.items)
    ? value.items
        .map((entry) => normalizeProductResultItem(entry))
        .filter((entry): entry is WebsiteAssistantProductResultItem => Boolean(entry))
    : [];

  if (type === "product_results" && items.length > 0) {
    return {
      type: "product_results",
      items,
    };
  }

  return {
    type: "none",
    items: [],
  };
};

const normalizeAction = (value: unknown): WebsiteAssistantAction => {
  if (!isRecord(value)) {
    return {
      type: "NONE",
      route: null,
      productRoute: null,
      label: null,
      handoffCommand: null,
    };
  }

  const type = asString(value.type).trim().toUpperCase();

  if (
    type !== "OPEN_ROUTE" &&
    type !== "START_LINE_CONNECT" &&
    type !== "ESCALATE_SUPPORT" &&
    type !== "OPEN_PRODUCT" &&
    type !== "OPEN_SUPPORT_PAGE" &&
    type !== "OPEN_CONTACT_PAGE"
  ) {
    return {
      type: "NONE",
      route: null,
      productRoute: null,
      label: null,
      handoffCommand: null,
    };
  }

  return {
    type,
    route: asNullableString(value.route),
    productRoute: asNullableString(value.productRoute),
    label: asNullableString(value.label),
    handoffCommand: asNullableString(value.handoffCommand),
  };
};

const normalizeChatResponse = (payload: unknown) => {
  const root = isRecord(payload) ? payload : null;
  const sessionId = asString(root?.sessionId).trim();

  if (!sessionId) {
    throw new WebsiteAssistantApiError({
      message: "Assistant response is missing a session ID.",
      status: 500,
      payload,
    });
  }

  const rootMessage = asString(root?.message).trim();
  const replyText =
    rootMessage ||
    (isRecord(root?.reply) ? asString(root.reply.text).trim() : "") ||
    "I’m ready to help with your next question.";

  return {
    ok: root?.ok !== false,
    sessionId,
    browserSessionId: asNullableString(root?.browserSessionId),
    message: replyText,
    mode: asString(root?.mode).trim() || "support",
    ui: normalizeUi(root?.ui),
    action: normalizeAction(root?.action),
    suggestedFollowUps: normalizeSuggestedFollowUps(root?.suggestedFollowUps),
    model: asString(root?.model).trim() || "unknown",
    handoffCommand: asString(root?.handoffCommand).trim() || DEFAULT_HANDOFF_COMMAND,
  } satisfies WebsiteAssistantChatResponse;
};

export type WebsiteAssistantChatRequest = {
  message: string;
  sessionId?: string | null;
  browserSessionId?: string | null;
  pagePath?: string | null;
  channel?: "website";
};

export type WebsiteAssistantChatResponse = {
  ok: boolean;
  sessionId: string;
  browserSessionId: string | null;
  message: string;
  mode: string;
  ui: WebsiteAssistantUi;
  action: WebsiteAssistantAction;
  suggestedFollowUps: string[];
  model: string;
  handoffCommand: string;
};

export class WebsiteAssistantApiError extends Error {
  status: number;
  payload: unknown;

  constructor({
    message,
    status,
    payload,
  }: {
    message: string;
    status: number;
    payload?: unknown;
  }) {
    super(message);
    this.name = "WebsiteAssistantApiError";
    this.status = status;
    this.payload = payload ?? null;
  }
}

const getCurrentAccessToken = async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || null;
  } catch {
    return null;
  }
};

export const sendWebsiteAssistantMessage = async (
  input: WebsiteAssistantChatRequest,
  options?: {
    signal?: AbortSignal;
  },
): Promise<WebsiteAssistantChatResponse> => {
  const message = input.message.trim();

  if (!message) {
    throw new WebsiteAssistantApiError({
      message: "Please enter a message.",
      status: 400,
    });
  }

  const body: WebsiteAssistantChatRequest = {
    message,
    channel: "website",
  };

  if (input.sessionId?.trim()) {
    body.sessionId = input.sessionId.trim();
  }

  if (input.browserSessionId?.trim()) {
    body.browserSessionId = input.browserSessionId.trim();
  }

  if (input.pagePath?.trim()) {
    body.pagePath = input.pagePath.trim();
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const accessToken = await getCurrentAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(WEBSITE_ASSISTANT_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new WebsiteAssistantApiError({
      message: "Unable to reach the assistant right now.",
      status: 0,
      payload: error,
    });
  }

  const payload = parseJsonSafely(await response.text());

  if (!response.ok) {
    throw new WebsiteAssistantApiError({
      message: buildErrorMessage(payload, "Unable to reach the assistant right now."),
      status: response.status,
      payload,
    });
  }

  return normalizeChatResponse(payload);
};
