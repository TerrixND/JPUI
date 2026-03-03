import type { ManagerBranchRef, ManagerBranchUser, ManagerProductSummary } from "./managerApi";

export const formatManagerDateTime = (value: string | null | undefined) => {
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

export const managerMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const managerStatusBadge = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "APPROVED" || normalized === "CONFIRMED") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (normalized === "REQUESTED" || normalized === "PENDING" || normalized === "RESTRICTED") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (normalized === "COMPLETED") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }
  if (normalized === "CANCELLED" || normalized === "BANNED" || normalized === "REJECTED") {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
  if (normalized === "TERMINATED" || normalized === "NO_SHOW") {
    return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
};

export const getManagerBranchLabel = (branch: ManagerBranchRef | null) =>
  [branch?.code, branch?.name].filter(Boolean).join(" · ") || branch?.id || "-";

export const getManagerUserLabel = (
  user: Pick<ManagerBranchUser, "displayName" | "email" | "userId">,
) => user.displayName || user.email || user.userId;

export const getManagerProductLabel = (
  product: Pick<ManagerProductSummary, "sku" | "name" | "id">,
) => [product.sku, product.name].filter(Boolean).join(" · ") || product.id;

export const getManagerProductPreviewUrl = (
  product: Pick<ManagerProductSummary, "previewImageUrl" | "media">,
) =>
  product.previewImageUrl ||
  product.media.find((entry) => entry.url)?.url ||
  product.media.find((entry) => entry.originalUrl)?.originalUrl ||
  "";
