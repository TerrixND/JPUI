import { resolveSafeReturnTo } from "./authRedirect";

export type LineAuthIntent = "login" | "signup" | "connect";

export type LineIdentity = {
  lineUserId: string | null;
  lineDisplayName: string | null;
};

type PendingLineAuthContext = {
  intent: LineAuthIntent;
  returnTo: string;
  state: string;
  nonce: string;
  redirectUri: string;
  createdAt: number;
};

type LineAuthorizeUrlResponse = {
  authorizeUrl: string;
  redirectUri: string;
  intent: LineAuthIntent;
  returnTo: string;
};

export type LineExchangeResponse = {
  intent?: LineAuthIntent;
  lineIdentity: {
    lineUserId: string | null;
    lineDisplayName: string | null;
    linePictureUrl?: string | null;
  };
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number | null;
    expiresAt: number | null;
    tokenType: string;
  };
  supabaseUser?: unknown;
};

const LINE_PENDING_AUTH_STORAGE_KEY = "line_oauth_pending_auth";
const MAX_PENDING_LINE_AUTH_AGE_MS = 10 * 60 * 1000;

const toSafeString = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeProviderName = (value: unknown): string =>
  String(value || "").trim().toLowerCase();

const normalizeIntent = (value: unknown): LineAuthIntent => {
  if (value === "signup") return "signup";
  if (value === "connect") return "connect";
  return "login";
};

const generateLineChallenge = (length = 48): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomBuffer = new Uint8Array(length);

  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(randomBuffer);
  } else {
    for (let index = 0; index < length; index += 1) {
      randomBuffer[index] = Math.floor(Math.random() * 256);
    }
  }

  let value = "";
  for (let index = 0; index < randomBuffer.length; index += 1) {
    value += chars[randomBuffer[index] % chars.length];
  }

  return value;
};

export const resolveLineIdentityFromSupabaseUser = (
  supabaseUser: unknown,
): LineIdentity => {
  const userRecord = toRecord(supabaseUser);
  const identities = Array.isArray(userRecord.identities)
    ? userRecord.identities
    : [];

  const lineIdentity =
    identities.find((identity) => {
      const identityRecord = toRecord(identity);
      const provider = normalizeProviderName(
        identityRecord.provider || identityRecord.identity_provider,
      );
      return provider === "line";
    }) || null;

  const identityRecord = toRecord(lineIdentity);
  const identityData = toRecord(identityRecord.identity_data);
  const userMetadata = toRecord(userRecord.user_metadata);

  const lineUserId =
    toSafeString(identityRecord.id) ||
    toSafeString(identityData.userId) ||
    toSafeString(identityData.user_id) ||
    toSafeString(identityData.sub) ||
    toSafeString(userMetadata.lineUserId) ||
    toSafeString(userMetadata.line_user_id);

  const lineDisplayName =
    toSafeString(identityData.displayName) ||
    toSafeString(identityData.display_name) ||
    toSafeString(identityData.name) ||
    toSafeString(userMetadata.displayName) ||
    toSafeString(userMetadata.full_name) ||
    toSafeString(userMetadata.name);

  return {
    lineUserId,
    lineDisplayName,
  };
};

const buildLineOAuthRedirectUrl = ({
  returnTo,
  intent,
}: {
  returnTo?: string | null;
  intent: LineAuthIntent;
}): string => {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const callbackUrl = new URL("/", baseUrl || "http://localhost:3001");
  const safeReturnTo = resolveSafeReturnTo(returnTo);

  callbackUrl.searchParams.set("lineAuth", "1");
  callbackUrl.searchParams.set("intent", intent);
  if (safeReturnTo) {
    callbackUrl.searchParams.set("returnTo", safeReturnTo);
  }

  return callbackUrl.toString();
};

const readPendingLineAuthContext = (): PendingLineAuthContext | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(LINE_PENDING_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingLineAuthContext>;
    const intent = normalizeIntent(parsed.intent);
    const returnTo = resolveSafeReturnTo(parsed.returnTo) || "/";
    const state = toSafeString(parsed.state);
    const nonce = toSafeString(parsed.nonce);
    const redirectUri = toSafeString(parsed.redirectUri);
    const createdAt =
      typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
        ? parsed.createdAt
        : 0;

    if (!state || !nonce || !redirectUri || !createdAt) {
      return null;
    }

    return {
      intent,
      returnTo,
      state,
      nonce,
      redirectUri,
      createdAt,
    };
  } catch {
    return null;
  }
};

const writePendingLineAuthContext = (context: PendingLineAuthContext) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    LINE_PENDING_AUTH_STORAGE_KEY,
    JSON.stringify(context),
  );
};

export const clearPendingLineAuthContext = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(LINE_PENDING_AUTH_STORAGE_KEY);
};

export const consumePendingLineAuthContext = (
  expectedState: string | null,
): PendingLineAuthContext => {
  const context = readPendingLineAuthContext();
  clearPendingLineAuthContext();

  if (!context) {
    throw new Error(
      "LINE login session is missing or expired. Please continue with LINE again.",
    );
  }

  if (!expectedState || context.state !== expectedState) {
    throw new Error(
      "LINE login state mismatch. Please continue with LINE again.",
    );
  }

  if (Date.now() - context.createdAt > MAX_PENDING_LINE_AUTH_AGE_MS) {
    throw new Error("LINE login session has expired. Please try again.");
  }

  return context;
};

const requestLineAuthorizeUrl = async ({
  state,
  nonce,
  intent,
  returnTo,
}: {
  state: string;
  nonce: string;
  intent: LineAuthIntent;
  returnTo: string;
}) => {
  const query = new URLSearchParams({
    state,
    nonce,
    intent,
    returnTo,
  });

  const response = await fetch(`/api/v1/auth/line/authorize?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | LineAuthorizeUrlResponse
    | { message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : "Unable to initialize LINE authorization.";
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid LINE authorize response.");
  }

  const authorizeUrl = toSafeString((payload as LineAuthorizeUrlResponse).authorizeUrl);
  const redirectUri = toSafeString((payload as LineAuthorizeUrlResponse).redirectUri);

  if (!authorizeUrl || !redirectUri) {
    throw new Error("LINE authorize response is missing required fields.");
  }

  return {
    authorizeUrl,
    redirectUri,
  };
};

export const startLineOAuth = async ({
  returnTo,
  intent,
}: {
  returnTo?: string | null;
  intent: LineAuthIntent;
}) => {
  if (typeof window === "undefined") {
    throw new Error("LINE login can only be started in the browser.");
  }

  const normalizedIntent = normalizeIntent(intent);
  const normalizedReturnTo = resolveSafeReturnTo(returnTo) || "/";
  const state = generateLineChallenge(56);
  const nonce = generateLineChallenge(56);

  const { authorizeUrl, redirectUri } = await requestLineAuthorizeUrl({
    state,
    nonce,
    intent: normalizedIntent,
    returnTo: normalizedReturnTo,
  });

  writePendingLineAuthContext({
    intent: normalizedIntent,
    returnTo: normalizedReturnTo,
    state,
    nonce,
    redirectUri:
      redirectUri ||
      buildLineOAuthRedirectUrl({
        returnTo: normalizedReturnTo,
        intent: normalizedIntent,
      }),
    createdAt: Date.now(),
  });

  window.location.assign(authorizeUrl);
};

export const exchangeLineAuthorizationCode = async ({
  code,
  nonce,
  redirectUri,
  intent,
}: {
  code: string;
  nonce: string;
  redirectUri: string;
  intent: LineAuthIntent;
}): Promise<LineExchangeResponse> => {
  const response = await fetch("/api/v1/auth/line/exchange", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      nonce,
      redirectUri,
      intent,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | LineExchangeResponse
    | { message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : "Unable to exchange LINE authorization code.";
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid LINE exchange response.");
  }

  const typed = payload as LineExchangeResponse;
  if (intent !== "connect" && (!typed.session?.accessToken || !typed.session?.refreshToken)) {
    throw new Error("LINE exchange response does not include a valid session.");
  }

  return typed;
};
