import type {
  AdminAccountStatus,
  AdminAuditLogRow,
  AdminBranchWithManagersRecord,
  AdminUserDetail,
  AdminUserListItem,
  StaffRuleManagerType,
} from "./apiClient";

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const readManagerType = (
  input:
    | null
    | Pick<AdminUserListItem, "role" | "raw">
    | Pick<AdminUserDetail, "role" | "managerProfile" | "raw">,
): StaffRuleManagerType | null => {
  if (!input) {
    return null;
  }

  if (String(input.role || "").trim().toUpperCase() !== "MANAGER") {
    return null;
  }

  const rootSources = [
    "managerProfile" in input ? asRecord(input.managerProfile) : null,
    asRecord(input.raw),
    asRecord(asRecord(input.raw)?.permissions),
    asRecord(asRecord(asRecord(input.raw)?.permissions)?.profile),
    asRecord(asRecord(asRecord(input.raw)?.permissions)?.configuredPermissions),
  ];

  const nestedSources = rootSources.flatMap((source) => [
    source,
    asRecord(source?.manager),
    asRecord(source?.permissions),
  ]);

  for (const source of nestedSources) {
    const managerType = String(source?.managerType || "").trim().toUpperCase();
    if (
      managerType === "STANDALONE" ||
      managerType === "BRANCH_MANAGER" ||
      managerType === "BRANCH_ADMIN"
    ) {
      return managerType as StaffRuleManagerType;
    }
  }

  return null;
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatRelativeTime = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const resolveProfileField = (detail: AdminUserDetail | null, key: string) => {
  if (!detail) return "";

  const sources = [
    detail.adminProfile,
    detail.managerProfile,
    detail.salespersonProfile,
    detail.customerProfile,
    detail.raw,
  ];

  for (const source of sources) {
    const record = asRecord(source);
    const rawValue = record?.[key];
    const normalized = asString(rawValue);
    if (normalized) {
      return normalized;
    }
  }

  return "";
};

export const getUserDisplayName = (
  user: Pick<AdminUserListItem, "displayName" | "email" | "id">,
) => {
  return user.displayName || user.email || user.id;
};

export const getUserDetailDisplayName = (detail: AdminUserDetail | null) => {
  if (!detail) return "-";

  const directDisplayName = resolveProfileField(detail, "displayName");
  if (directDisplayName) {
    return directDisplayName;
  }

  return detail.email || detail.id;
};

export const getUserPhone = (detail: AdminUserDetail | null) =>
  resolveProfileField(detail, "phone") || resolveProfileField(detail, "phoneNumber") || "-";

export const getUserLineId = (detail: AdminUserDetail | null) =>
  resolveProfileField(detail, "lineId") || resolveProfileField(detail, "lineID") || "-";

export const getUserEmail = (detail: AdminUserDetail | null) => detail?.email || "-";

export const getPrimaryBranchName = (
  row:
    | Pick<AdminUserListItem, "branchMemberships">
    | Pick<AdminUserDetail, "branchMemberships">,
) => {
  const primary = row.branchMemberships.find((item) => item.isPrimary);
  if (primary?.branch?.name) return primary.branch.name;
  const first = row.branchMemberships[0];
  return first?.branch?.name || "-";
};

export const getUserRoleLabel = (
  user:
    | null
    | Pick<AdminUserListItem, "role" | "isMainAdmin" | "raw" | "branchMemberships">
    | Pick<AdminUserDetail, "role" | "isMainAdmin" | "managerProfile" | "raw" | "branchMemberships">,
) => {
  if (!user) {
    return "-";
  }

  if (user.isMainAdmin) {
    return "Main Admin";
  }

  const normalizedRole = String(user.role || "").trim().toUpperCase();
  if (normalizedRole === "MANAGER") {
    const managerType = readManagerType(user);
    if (managerType === "BRANCH_ADMIN") {
      return "Branch Admin";
    }
    if (managerType === "BRANCH_MANAGER") {
      return "Branch Manager";
    }
    if (managerType === "STANDALONE") {
      return "Standalone Manager";
    }
    return "Manager";
  }

  if (normalizedRole === "ADMIN") {
    return "Admin";
  }
  if (normalizedRole === "SALES") {
    return "Sales";
  }
  if (normalizedRole === "CUSTOMER") {
    return "Customer";
  }

  return normalizedRole || "-";
};

export const getUserRoleContextLabel = (
  user:
    | null
    | Pick<AdminUserListItem, "role" | "isMainAdmin" | "raw" | "branchMemberships">
    | Pick<AdminUserDetail, "role" | "isMainAdmin" | "managerProfile" | "raw" | "branchMemberships">,
) => {
  if (!user) {
    return "";
  }

  if (user.isMainAdmin) {
    return "";
  }

  const managerType = readManagerType(user);
  if (managerType === "BRANCH_ADMIN" || managerType === "BRANCH_MANAGER") {
    const branchName = getPrimaryBranchName(user);
    return branchName !== "-" ? branchName : "";
  }

  return "";
};

export const getPrimaryManagerLabel = (branch: AdminBranchWithManagersRecord) => {
  const manager =
    branch.primaryManager ||
    branch.managers.find((entry) => entry.isPrimaryMembership) ||
    branch.managers[0];

  if (!manager) {
    return "-";
  }

  return manager.displayName || manager.email || manager.id;
};

export const accountStatusBadge = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toUpperCase() as AdminAccountStatus;
  if (normalized === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (normalized === "RESTRICTED") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (normalized === "BANNED") {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
  if (normalized === "SUSPENDED") {
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  }
  if (normalized === "TERMINATED") {
    return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
};

export const roleBadge = (role: string | null | undefined, isMainAdmin?: boolean) => {
  if (isMainAdmin) {
    return "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300";
  }

  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === "ADMIN") {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
  if (normalized === "MANAGER") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (normalized === "SALES") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (normalized === "CUSTOMER") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
};

export const hasEditablePermissionControls = (
  role: string | null | undefined,
  isMainAdmin?: boolean,
) => {
  if (isMainAdmin) {
    return false;
  }

  const normalized = String(role || "").trim().toUpperCase();
  return normalized === "ADMIN" || normalized === "MANAGER" || normalized === "SALES";
};

export const permissionEditabilityBadge = (
  role: string | null | undefined,
  isMainAdmin?: boolean,
) => {
  if (isMainAdmin) {
    return {
      label: "Protected Permissions",
      className:
        "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:ring-fuchsia-700/50",
    };
  }

  if (hasEditablePermissionControls(role, false)) {
    return {
      label: "Editable Permissions",
      className:
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-700/50",
    };
  }

  return {
    label: "No Permission Editor",
    className:
      "bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/60",
  };
};

export const approvalStatusBadge = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PENDING") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (normalized === "APPROVED") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (normalized === "REJECTED") {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
};

export const branchStatusBadge = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (normalized === "INACTIVE") {
    return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
};

export const dedupeAuditRows = (rows: AdminAuditLogRow[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.id || seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
};
