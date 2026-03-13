const WEBSITE_ASSISTANT_ENDPOINT = "/api/v1/public/ai/chat";
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

const normalizeChatResponse = (payload: unknown) => {
  const root = isRecord(payload) ? payload : null;
  const reply = root && isRecord(root.reply) ? root.reply : null;
  const sessionId = asString(root?.sessionId).trim();

  if (!sessionId) {
    throw new WebsiteAssistantApiError({
      message: "Assistant response is missing a session ID.",
      status: 500,
      payload,
    });
  }

  return {
    sessionId,
    browserSessionId: asNullableString(root?.browserSessionId),
    reply: {
      text: asString(reply?.text).trim(),
    },
    model: asString(root?.model).trim() || "unknown",
    handoffCommand: asString(root?.handoffCommand).trim() || DEFAULT_HANDOFF_COMMAND,
  } satisfies WebsiteAssistantChatResponse;
};

export type WebsiteAssistantChatRequest = {
  message: string;
  sessionId?: string | null;
  browserSessionId?: string | null;
  pagePath?: string | null;
};

export type WebsiteAssistantChatResponse = {
  sessionId: string;
  browserSessionId: string | null;
  reply: {
    text: string;
  };
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

  let response: Response;

  try {
    response = await fetch(WEBSITE_ASSISTANT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
