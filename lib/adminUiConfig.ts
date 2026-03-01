import type {
  AdminAccountStatus,
  CustomerTier,
  StaffRuleVisibilityRole,
} from "./apiClient";

export type AdminCapabilityKey =
  | "canReadProducts"
  | "canCreateProducts"
  | "canEditProducts"
  | "canHandleRequests"
  | "canDeleteLogs"
  | "canManageProductVisibility"
  | "canManageStaffRules"
  | "canRestrictUsers"
  | "canBanUsers";

export type AdminCapabilityDefinition = {
  key: AdminCapabilityKey;
  label: string;
  helper: string;
  approval: "Main admin approval" | "Optional auto approval" | "Direct";
};

export const ADMIN_VISIBILITY_ROLE_OPTIONS: StaffRuleVisibilityRole[] = [
  "ADMIN",
  "MANAGER",
  "SALES",
];

export const ADMIN_CAPABILITY_DEFINITIONS: AdminCapabilityDefinition[] = [
  {
    key: "canReadProducts",
    label: "Read Products",
    helper: "View products within the assigned visibility role.",
    approval: "Direct",
  },
  {
    key: "canCreateProducts",
    label: "Create Products",
    helper: "Create new products. Product edit should also be enabled.",
    approval: "Optional auto approval",
  },
  {
    key: "canEditProducts",
    label: "Edit Products",
    helper: "Edit existing products, even without create access.",
    approval: "Optional auto approval",
  },
  {
    key: "canHandleRequests",
    label: "Handle Requests",
    helper: "Review and decide manager requests routed to admin.",
    approval: "Direct",
  },
  {
    key: "canDeleteLogs",
    label: "Delete Logs",
    helper: "Delete log records. Viewing logs stays allowed without this.",
    approval: "Main admin approval",
  },
  {
    key: "canManageProductVisibility",
    label: "Manage Product Visibility",
    helper: "Change product visibility directly from listing quick actions or edit flow.",
    approval: "Optional auto approval",
  },
  {
    key: "canManageStaffRules",
    label: "Manage Staff Rule",
    helper: "Create and update staff onboarding rules.",
    approval: "Optional auto approval",
  },
  {
    key: "canRestrictUsers",
    label: "Restrict Users",
    helper: "Apply timed account or capability restrictions.",
    approval: "Optional auto approval",
  },
  {
    key: "canBanUsers",
    label: "Ban Users",
    helper: "Apply timed bans. Permanent termination remains a main admin action.",
    approval: "Main admin approval",
  },
];

export const ACCOUNT_STATUS_OPTIONS: AdminAccountStatus[] = [
  "ACTIVE",
  "RESTRICTED",
  "BANNED",
  "SUSPENDED",
  "TERMINATED",
];

export type ProductVisibilityOption =
  | "PRIVATE"
  | "STAFF"
  | "PUBLIC"
  | "TOP_SHELF"
  | "USER_TIER"
  | "TARGETED_USER";

export type ProductTierOption = "STANDARD" | "VIP" | "ULTRA_RARE";
export type ProductStatusOption = "AVAILABLE" | "PENDING" | "BUSY" | "SOLD";
export type WeightUnitOption = "g" | "ct";

export const PRODUCT_VISIBILITY_OPTIONS: ProductVisibilityOption[] = [
  "PRIVATE",
  "STAFF",
  "PUBLIC",
  "TOP_SHELF",
  "USER_TIER",
  "TARGETED_USER",
];

export const PRODUCT_TIER_OPTIONS: ProductTierOption[] = [
  "STANDARD",
  "VIP",
  "ULTRA_RARE",
];

export const PRODUCT_STATUS_OPTIONS: ProductStatusOption[] = [
  "AVAILABLE",
  "PENDING",
  "BUSY",
  "SOLD",
];

export const CUSTOMER_TIER_OPTIONS: CustomerTier[] = [
  "REGULAR",
  "VIP",
  "ULTRA_VIP",
];

export const WEIGHT_UNIT_OPTIONS: WeightUnitOption[] = ["g", "ct"];

export const PRODUCT_VISIBILITY_COPY: Record<
  ProductVisibilityOption,
  {
    label: string;
    helper: string;
  }
> = {
  PRIVATE: {
    label: "Private",
    helper: "Visible only to admin staff.",
  },
  STAFF: {
    label: "Staff",
    helper: "Visible to admin, manager, and sales staff only.",
  },
  PUBLIC: {
    label: "Public",
    helper: "Visible globally in the product page catalog.",
  },
  TOP_SHELF: {
    label: "Top-Shelf",
    helper: "Visible globally with premium home-page placement.",
  },
  USER_TIER: {
    label: "User-Tier",
    helper: "Visible only to the selected customer tier.",
  },
  TARGETED_USER: {
    label: "Targeted User",
    helper: "Visible only to explicitly selected customers.",
  },
};

export const ROLE_MEDIA_VISIBILITY_OPTIONS = ["ADMIN", "MANAGER", "SALES"] as const;

export const SOURCE_TYPE_OPTIONS = ["OWNED", "CONSIGNED"] as const;
export const PRODUCT_ACTION_TYPE_OPTIONS = [
  "RESTRICTION",
  "BAN",
  "TERMINATION",
] as const;

export type QuickVisibilityChoice = {
  value: string;
  label: string;
  helper: string;
};

type QuickVisibilityInput = {
  visibility: string | null | undefined;
  customerTier: string | null | undefined;
};

export const deriveQuickVisibilityChoices = ({
  visibility,
  customerTier,
}: QuickVisibilityInput): QuickVisibilityChoice[] => {
  const normalizedVisibility = String(visibility || "PRIVATE").trim().toUpperCase();
  const normalizedTier = String(customerTier || "").trim().toUpperCase();

  if (normalizedVisibility === "USER_TIER") {
    return [
      {
        value: "USER_TIER",
        label: "User-Tier",
        helper: "Quick updates stay inside tier-targeted visibility.",
      },
    ];
  }

  if (normalizedVisibility === "TARGETED_USER") {
    return [
      {
        value: "TARGETED_USER",
        label: "Targeted User",
        helper: "Quick updates stay inside targeted-user visibility.",
      },
    ];
  }

  if (
    (normalizedVisibility === "PRIVATE" || normalizedVisibility === "STAFF") &&
    normalizedTier
  ) {
    return [
      {
        value: "USER_TIER",
        label: "User-Tier",
        helper: "Tier-scoped private or staff products can only quick update within USER_TIER.",
      },
    ];
  }

  if (normalizedVisibility === "PUBLIC" || normalizedVisibility === "TOP_SHELF") {
    return [
      {
        value: "PUBLIC",
        label: "Public",
        helper: "Keep the product visible in the public catalog.",
      },
      {
        value: "TOP_SHELF",
        label: "Top-Shelf",
        helper: "Promote the product into top-shelf placement.",
      },
    ];
  }

  return [
    {
      value: "PRIVATE",
      label: "Private",
      helper: "Limit the product to admin-only visibility.",
    },
    {
      value: "STAFF",
      label: "Staff",
      helper: "Keep the product visible to staff only.",
    },
    {
      value: "PUBLIC",
      label: "Public",
      helper: "Show the product in the public catalog.",
    },
    {
      value: "TOP_SHELF",
      label: "Top-Shelf",
      helper: "Promote the product in top-shelf placement.",
    },
  ];
};

export const toVisibilityLabel = (value: string | null | undefined) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return "Private";
  }

  return PRODUCT_VISIBILITY_COPY[normalized as ProductVisibilityOption]?.label
    || normalized.replace(/_/g, " ");
};

export const gramsToCarats = (value: number) => value * 5;
export const caratsToGrams = (value: number) => value / 5;
