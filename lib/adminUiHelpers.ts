import type {
  AdminAccountStatus,
  AdminAuditLogRow,
  AdminBranchWithManagersRecord,
  AdminUserDetail,
  AdminUserListItem,
} from "./apiClient";

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

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
