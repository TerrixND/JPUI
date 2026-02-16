type SetupUserPayload = {
  displayName?: string;
  phone?: string;
  lineId?: string;
  preferredLanguage?: string;
  city?: string;
};

type PendingSetupProfile = {
  email: string;
  payload: SetupUserPayload;
};

const PENDING_SETUP_STORAGE_KEY = "pending_user_setup_profile";
const SETUP_USER_ENDPOINT = "/api/v1/auth/setup-user";

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
      return {
        email: parsed.email,
        payload: parsed.payload,
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
) => {
  if (typeof window === "undefined") {
    return;
  }

  const value: PendingSetupProfile = {
    email: email.trim().toLowerCase(),
    payload,
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

export const clearPendingSetupPayload = () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(PENDING_SETUP_STORAGE_KEY);
};

export const setupUser = async (
  accessToken: string,
  payload: SetupUserPayload = {},
) => {
  let response: Response;

  try {
    response = await fetch(SETUP_USER_ENDPOINT, {
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
