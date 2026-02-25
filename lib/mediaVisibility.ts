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
