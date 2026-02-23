type SetupUserPayload = {
  displayName?: string;
  phone?: string;
  lineId?: string;
  preferredLanguage?: string;
  city?: string;
};

type OnboardingMode = "setup-user" | "bootstrap-admin";

type SignupPrecheckPayload = SetupUserPayload & {
  email: string;
};

type SignupPrecheckResponse = {
  eligible?: boolean;
  message?: string;
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

type PendingSetupProfile = {
  email: string;
  payload: SetupUserPayload;
  onboardingMode?: OnboardingMode;
};

const PENDING_SETUP_STORAGE_KEY = "pending_user_setup_profile";
const PRECHECK_SIGNUP_ENDPOINT = "/api/v1/auth/precheck-signup";
const SETUP_USER_ENDPOINT = "/api/v1/auth/setup-user";
const BOOTSTRAP_ADMIN_ENDPOINT = "/api/v1/auth/bootstrap-admin";

const parseOnboardingModeFromString = (value: string): OnboardingMode | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("bootstrap-admin") ||
    normalized.includes("bootstrap_admin") ||
    normalized.includes("bootstrap") ||
    normalized.includes("super_admin") ||
    normalized.includes("superadmin")
  ) {
    return "bootstrap-admin";
  }

  if (
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
    precheckResponse.bootstrapEnabled,
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
    throw new Error(`Unable to reach signup precheck endpoint. ${message}`);
  }

  const responseData = (await response.json().catch(() => null)) as
    | SignupPrecheckResponse
    | null;

  const message =
    responseData &&
    typeof responseData === "object" &&
    "message" in responseData &&
    typeof responseData.message === "string"
      ? responseData.message
      : "Signup precheck failed.";

  if (!response.ok) {
    throw new Error(message);
  }

  if (!responseData || responseData.eligible !== true) {
    throw new Error(message);
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

  if (!response.ok) {
    const message =
      responseData &&
      typeof responseData === "object" &&
      "message" in responseData &&
      typeof responseData.message === "string"
        ? responseData.message
        : "Failed to setup user.";

    throw new Error(message);
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
