import type {
  CustomerTier,
  MediaRole,
  MediaVisibilityPreset,
} from "@/lib/apiClient";

export const PUBLIC_MEDIA_VISIBILITY_PRESETS: MediaVisibilityPreset[] = [
  "PUBLIC",
  "TOP_SHELF",
  "USER_TIER",
  "TARGETED_USER",
  "PRIVATE",
];

export const ROLE_MEDIA_VISIBILITY_PRESETS: MediaVisibilityPreset[] = [
  "ADMIN",
  "MANAGER",
  "SALES",
];

export const CUSTOMER_TIER_OPTIONS: CustomerTier[] = ["REGULAR", "VIP", "ULTRA_VIP"];

export const isPublicVisibilityPreset = (
  preset: MediaVisibilityPreset | null | undefined,
): preset is Extract<
  MediaVisibilityPreset,
  "PUBLIC" | "TOP_SHELF" | "USER_TIER" | "TARGETED_USER" | "PRIVATE"
> => Boolean(preset && PUBLIC_MEDIA_VISIBILITY_PRESETS.includes(preset));

export const isRoleVisibilityPreset = (
  preset: MediaVisibilityPreset | null | undefined,
): preset is Extract<MediaVisibilityPreset, "ADMIN" | "MANAGER" | "SALES"> =>
  Boolean(preset && ROLE_MEDIA_VISIBILITY_PRESETS.includes(preset));

export const parseTargetUserIdsInput = (value: string) =>
  [...new Set(value.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean))];

export const toRoleVisibilityPreset = (
  value: MediaRole | string | null | undefined,
): Extract<MediaVisibilityPreset, "ADMIN" | "MANAGER" | "SALES"> | null => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ADMIN" || normalized === "MANAGER" || normalized === "SALES") {
    return normalized;
  }

  return null;
};

export const deriveVisibilityPresetFromMedia = ({
  visibilityPreset,
  audience,
  visibilitySections,
  allowedRoles,
  minCustomerTier,
  targetUsers,
}: {
  visibilityPreset?: string | null;
  audience?: string | null;
  visibilitySections?: string[] | null;
  allowedRoles?: string[] | null;
  minCustomerTier?: string | null;
  targetUsers?: Array<{ userId?: string | null }> | null;
}): MediaVisibilityPreset | null => {
  const normalizedPreset = String(visibilityPreset || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (
    normalizedPreset === "PUBLIC" ||
    normalizedPreset === "TOP_SHELF" ||
    normalizedPreset === "USER_TIER" ||
    normalizedPreset === "TARGETED_USER" ||
    normalizedPreset === "PRIVATE" ||
    normalizedPreset === "ADMIN" ||
    normalizedPreset === "MANAGER" ||
    normalizedPreset === "SALES"
  ) {
    return normalizedPreset;
  }

  const normalizedAudience = String(audience || "").trim().toUpperCase();
  const normalizedSections = (Array.isArray(visibilitySections) ? visibilitySections : [])
    .map((section) => String(section || "").trim().toUpperCase());
  const normalizedRoles = (Array.isArray(allowedRoles) ? allowedRoles : [])
    .map((role) => String(role || "").trim().toUpperCase());
  const hasTargetUsers = (Array.isArray(targetUsers) ? targetUsers : [])
    .some((row) => Boolean(String(row?.userId || "").trim()));
  const normalizedTier = String(minCustomerTier || "").trim().toUpperCase();

  if (normalizedAudience === "ROLE_BASED") {
    if (normalizedRoles.includes("ADMIN")) return "ADMIN";
    if (normalizedRoles.includes("MANAGER")) return "MANAGER";
    if (normalizedRoles.includes("SALES")) return "SALES";
    return null;
  }

  if (normalizedAudience === "ADMIN_ONLY") {
    return "ADMIN";
  }

  if (normalizedAudience === "PRIVATE") {
    return "PRIVATE";
  }

  if (normalizedAudience === "PUBLIC") {
    if (normalizedSections.includes("TOP_SHELF")) {
      return "TOP_SHELF";
    }
    return "PUBLIC";
  }

  if (normalizedAudience === "TARGETED") {
    if (hasTargetUsers) return "TARGETED_USER";
    if (normalizedTier === "REGULAR" || normalizedTier === "VIP" || normalizedTier === "ULTRA_VIP") {
      return "USER_TIER";
    }
    return "TARGETED_USER";
  }

  return null;
};

type PublicFacingMedia = {
  visibilityPreset?: string | null;
  audience?: string | null;
  visibilitySections?: string[] | null;
  allowedRoles?: string[] | null;
  minCustomerTier?: string | null;
  targetUsers?: Array<{ userId?: string | null }> | null;
};

export const isPublicFacingMedia = (media: PublicFacingMedia | null | undefined) => {
  if (!media) {
    return false;
  }

  const preset = deriveVisibilityPresetFromMedia(media);
  if (preset) {
    return isPublicVisibilityPreset(preset);
  }

  const normalizedAudience = String(media.audience || "").trim().toUpperCase();
  if (normalizedAudience) {
    return normalizedAudience !== "ROLE_BASED" && normalizedAudience !== "ADMIN_ONLY";
  }

  const allowedRoles = Array.isArray(media.allowedRoles) ? media.allowedRoles : [];
  return allowedRoles.length === 0;
};

export const isVisibleOnPublicProductPage = (
  media: PublicFacingMedia | null | undefined,
) => {
  if (!isPublicFacingMedia(media)) {
    return false;
  }

  const visibilitySections = Array.isArray(media?.visibilitySections)
    ? media.visibilitySections
    : [];

  return visibilitySections.some(
    (section) => String(section || "").trim().toUpperCase() === "PRODUCT_PAGE",
  );
};

export const isVisibleOnAuthenticityPage = (
  media: PublicFacingMedia | null | undefined,
) => isPublicFacingMedia(media);
