type SetupUserPayload = {
  displayName?: string;
  phone?: string;
  lineId?: string;
  preferredLanguage?: string;
  city?: string;
};

type OnboardingMode = "setup-user" | "bootstrap-admin";
type SignupFlow = "SETUP_USER" | "BOOTSTRAP_ADMIN";

type SignupPrecheckPayload = SetupUserPayload & {
  email: string;
  flow?: SignupFlow;
  bootstrapSecret?: string;
};

type LoginPrecheckPayload = {
  email: string;
  phone?: string;
};

type SignupPrecheckResponse = {
  eligible?: boolean;
  message?: string;
  code?: string;
  flow?: string;
  onboardingType?: string;
  onboardingMode?: string;
  bootstrapEnabled?: boolean;
  bootstrapAdmin?: boolean;
  shouldBootstrapAdmin?: boolean;
  isBootstrapAdmin?: boolean;
  requiresBootstrapAdmin?: boolean;
  role?: string;
  nextEndpoint?: string;
  targetEndpoint?: string;
  [key: string]: unknown;
};

type LoginPrecheckResponse = {
  eligible?: boolean;
  message?: string;
  code?: string;
  flow?: string;
  [key: string]: unknown;
};

type PendingSetupProfile = {
  email: string;
  payload: SetupUserPayload;
  onboardingMode?: OnboardingMode;
};

const PENDING_SETUP_STORAGE_KEY = "pending_user_setup_profile";
const PRECHECK_LOGIN_ENDPOINT = "/api/v1/auth/precheck-login";
const PRECHECK_SIGNUP_ENDPOINT = "/api/v1/auth/precheck-signup";
const SETUP_USER_ENDPOINT = "/api/v1/auth/setup-user";
const BOOTSTRAP_ADMIN_ENDPOINT = "/api/v1/auth/bootstrap-admin";
export const AUTH_BLOCKED_CODES = new Set([
  "ACCOUNT_BANNED",
  "ACCOUNT_TERMINATED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_RESTRICTED",
  "CONTACT_BLOCKED",
]);

export class AuthFlowError extends Error {
  status: number;
  code: string | null;
  details: Record<string, unknown> | null;

  constructor({
    message,
    status,
    code,
    details,
  }: {
    message: string;
    status: number;
    code?: string | null;
    details?: Record<string, unknown> | null;
  }) {
    super(message);
    this.name = "AuthFlowError";
    this.status = status;
    this.code = code ?? null;
    this.details = details ?? null;
  }
}

export const isAuthBlockedCode = (value: unknown) =>
  typeof value === "string" && AUTH_BLOCKED_CODES.has(value.trim().toUpperCase());

export const isAuthBlockedError = (value: unknown): value is AuthFlowError =>
  value instanceof AuthFlowError && isAuthBlockedCode(value.code);

const parseOnboardingModeFromString = (value: string): OnboardingMode | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === "bootstrap_admin" ||
    normalized === "bootstrapped_admin" ||
    normalized === "admin_bootstrap" ||
    normalized.includes("bootstrap-admin") ||
    normalized.includes("bootstrap_admin") ||
    normalized.includes("bootstrap") ||
    normalized.includes("super_admin") ||
    normalized.includes("superadmin")
  ) {
    return "bootstrap-admin";
  }

  if (
    normalized === "setup_user" ||
    normalized === "staff" ||
    normalized.includes("setup-user") ||
    normalized.includes("setup_user") ||
    normalized.includes("setup") ||
    normalized.includes("customer")
  ) {
    return "setup-user";
  }

  return null;
};

export const resolveOnboardingMode = (
  precheckResponse: SignupPrecheckResponse | null,
): OnboardingMode => {
  if (!precheckResponse || typeof precheckResponse !== "object") {
    return "setup-user";
  }

  const directModeCandidates = [
    precheckResponse.flow,
    precheckResponse.onboardingType,
    precheckResponse.onboardingMode,
    precheckResponse.nextEndpoint,
    precheckResponse.targetEndpoint,
    precheckResponse.role,
  ];

  for (const candidate of directModeCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const parsed = parseOnboardingModeFromString(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const bootstrapFlagCandidates = [
    precheckResponse.bootstrapAdmin,
    precheckResponse.shouldBootstrapAdmin,
    precheckResponse.isBootstrapAdmin,
    precheckResponse.requiresBootstrapAdmin,
  ];

  if (bootstrapFlagCandidates.some((value) => value === true)) {
    return "bootstrap-admin";
  }

  return "setup-user";
};

const readPendingSetupStorage = (): PendingSetupProfile | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(PENDING_SETUP_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.email === "string" &&
      parsed.payload &&
      typeof parsed.payload === "object"
    ) {
      const onboardingMode =
        parsed.onboardingMode === "bootstrap-admin" ||
        parsed.onboardingMode === "setup-user"
          ? parsed.onboardingMode
          : undefined;

      return {
        email: parsed.email,
        payload: parsed.payload,
        onboardingMode,
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const storePendingSetupPayload = (
  email: string,
  payload: SetupUserPayload,
  onboardingMode: OnboardingMode = "setup-user",
) => {
  if (typeof window === "undefined") {
    return;
  }

  const value: PendingSetupProfile = {
    email: email.trim().toLowerCase(),
    payload,
    onboardingMode,
  };

  localStorage.setItem(PENDING_SETUP_STORAGE_KEY, JSON.stringify(value));
};

export const getPendingSetupPayloadForEmail = (
  email: string,
): SetupUserPayload | null => {
  const pendingProfile = readPendingSetupStorage();

  if (!pendingProfile) {
    return null;
  }

  if (pendingProfile.email !== email.trim().toLowerCase()) {
    return null;
  }

  return pendingProfile.payload;
};

export const getPendingSetupProfileForEmail = (
  email: string,
): { payload: SetupUserPayload; onboardingMode: OnboardingMode } | null => {
  const pendingProfile = readPendingSetupStorage();

  if (!pendingProfile) {
    return null;
  }

  if (pendingProfile.email !== email.trim().toLowerCase()) {
    return null;
  }

  return {
    payload: pendingProfile.payload,
    onboardingMode: pendingProfile.onboardingMode || "setup-user",
  };
};

export const clearPendingSetupPayload = () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(PENDING_SETUP_STORAGE_KEY);
};

export const precheckSignup = async (
  payload: SignupPrecheckPayload,
): Promise<SignupPrecheckResponse> => {
  let response: Response;

  try {
    response = await fetch(PRECHECK_SIGNUP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";
    throw new AuthFlowError({
      message: `Unable to reach signup precheck endpoint. ${message}`,
      status: 502,
    });
  }

  const responseData = (await response.json().catch(() => null)) as
    | SignupPrecheckResponse
    | null;
  const responseRecord =
    responseData && typeof responseData === "object" && !Array.isArray(responseData)
      ? (responseData as Record<string, unknown>)
      : null;
  const message =
    typeof responseRecord?.message === "string"
      ? responseRecord.message
      : "Signup precheck failed.";
  const code =
    typeof responseRecord?.code === "string" ? responseRecord.code : null;
  const details =
    responseRecord?.details && typeof responseRecord.details === "object" && !Array.isArray(responseRecord.details)
      ? (responseRecord.details as Record<string, unknown>)
      : null;

  if (!response.ok) {
    throw new AuthFlowError({
      message,
      status: response.status,
      code,
      details,
    });
  }

  if (!responseData || responseData.eligible !== true) {
    throw new AuthFlowError({
      message,
      status: response.status,
      code,
      details,
    });
  }

  return responseData;
};

export const precheckLogin = async (
  payload: LoginPrecheckPayload,
): Promise<LoginPrecheckResponse> => {
  let response: Response;

  try {
    response = await fetch(PRECHECK_LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";
    throw new AuthFlowError({
      message: `Unable to reach login precheck endpoint. ${message}`,
      status: 502,
    });
  }

  const responseData = (await response.json().catch(() => null)) as
    | LoginPrecheckResponse
    | null;
  const responseRecord =
    responseData && typeof responseData === "object" && !Array.isArray(responseData)
      ? (responseData as Record<string, unknown>)
      : null;

  const message =
    typeof responseRecord?.message === "string"
      ? responseRecord.message
      : "Login precheck failed.";
  const code =
    typeof responseRecord?.code === "string" ? responseRecord.code : null;
  const details =
    responseRecord?.details && typeof responseRecord.details === "object" && !Array.isArray(responseRecord.details)
      ? (responseRecord.details as Record<string, unknown>)
      : null;

  if (!response.ok) {
    throw new AuthFlowError({
      message,
      status: response.status,
      code,
      details,
    });
  }

  if (!responseData || responseData.eligible !== true) {
    throw new AuthFlowError({
      message,
      status: response.status,
      code,
      details,
    });
  }

  return responseData;
};

const callOnboardingEndpoint = async (
  endpoint: string,
  accessToken: string,
  payload: SetupUserPayload = {},
) => {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";
    throw new Error(`Unable to reach account setup endpoint. ${message}`);
  }

  const responseData = await response.json().catch(() => null);
  const responseRecord =
    responseData && typeof responseData === "object" && !Array.isArray(responseData)
      ? (responseData as Record<string, unknown>)
      : null;

  if (!response.ok) {
    const message =
      typeof responseRecord?.message === "string"
        ? responseRecord.message
        : "Failed to setup user.";
    const code =
      typeof responseRecord?.code === "string" ? responseRecord.code : null;
    const details =
      responseRecord?.details &&
      typeof responseRecord.details === "object" &&
      !Array.isArray(responseRecord.details)
        ? (responseRecord.details as Record<string, unknown>)
        : null;

    throw new AuthFlowError({
      message,
      status: response.status,
      code,
      details,
    });
  }

  return responseData;
};

export const setupUser = async (
  accessToken: string,
  payload: SetupUserPayload = {},
) => callOnboardingEndpoint(SETUP_USER_ENDPOINT, accessToken, payload);

export const bootstrapAdmin = async (
  accessToken: string,
  payload: SetupUserPayload = {},
) => callOnboardingEndpoint(BOOTSTRAP_ADMIN_ENDPOINT, accessToken, payload);
