export const resolveSafeReturnTo = (value: string | null | undefined) => {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized || !normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }

  return normalized;
};

export const buildAuthRouteWithReturnTo = (
  pathname: string,
  returnTo: string | null | undefined,
) => {
  const safeReturnTo = resolveSafeReturnTo(returnTo);
  if (!safeReturnTo) {
    return pathname;
  }

  const searchParams = new URLSearchParams({
    returnTo: safeReturnTo,
  });

  return `${pathname}?${searchParams.toString()}`;
};
