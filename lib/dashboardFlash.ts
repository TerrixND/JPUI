export type DashboardFlashTone = "success" | "info" | "error";

export type DashboardFlashMessage = {
  tone: DashboardFlashTone;
  message: string;
};

const ADMIN_PRODUCTS_FLASH_KEY = "admin-products-flash";

const normalizeFlash = (value: unknown): DashboardFlashMessage | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    tone?: unknown;
    message?: unknown;
  };

  const tone =
    candidate.tone === "success" || candidate.tone === "info" || candidate.tone === "error"
      ? candidate.tone
      : null;
  const message = typeof candidate.message === "string" ? candidate.message.trim() : "";

  if (!tone || !message) {
    return null;
  }

  return {
    tone,
    message,
  };
};

export const setAdminProductsFlash = (flash: DashboardFlashMessage) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ADMIN_PRODUCTS_FLASH_KEY, JSON.stringify(flash));
};

export const consumeAdminProductsFlash = (): DashboardFlashMessage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(ADMIN_PRODUCTS_FLASH_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(ADMIN_PRODUCTS_FLASH_KEY);

  try {
    return normalizeFlash(JSON.parse(raw));
  } catch {
    return null;
  }
};
