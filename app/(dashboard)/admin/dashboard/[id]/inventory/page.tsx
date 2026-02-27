"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import {
  getAdminInventoryRequests,
  type AdminInventoryRequestRecord,
} from "@/lib/apiClient";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING_MANAGER,PENDING_MAIN" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Fulfilled", value: "FULFILLED" },
  { label: "Cancelled", value: "CANCELLED" },
] as const;

type Filters = {
  statusCsv: string;
  branchId: string;
  appointmentId: string;
  appointmentItemId: string;
  productId: string;
  requestedByUserId: string;
  from: string;
  to: string;
};

const initialFilters: Filters = {
  statusCsv: "",
  branchId: "",
  appointmentId: "",
  appointmentItemId: "",
  productId: "",
  requestedByUserId: "",
  from: "",
  to: "",
};

const normalizeCsv = (value: string) =>
  value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .join(",");

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unexpected error.";
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusStyle = (status: string | null) => {
  switch (status) {
    case "PENDING_MANAGER":
    case "PENDING_MAIN":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "APPROVED":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    case "FULFILLED":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
    case "REJECTED":
      return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    case "CANCELLED":
      return "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";
  }
};

export default function AdminInventory() {
  const [rows, setRows] = useState<AdminInventoryRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const accessToken = session?.access_token || "";
    if (!accessToken) {
      throw new Error("Missing access token. Please sign in again.");
    }

    return accessToken;
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const normalizedStatusCsv = normalizeCsv(appliedFilters.statusCsv);
      const response = await getAdminInventoryRequests({
        accessToken,
        page,
        limit,
        status: normalizedStatusCsv || undefined,
        branchId: appliedFilters.branchId.trim() || undefined,
        appointmentId: appliedFilters.appointmentId.trim() || undefined,
        appointmentItemId: appliedFilters.appointmentItemId.trim() || undefined,
        productId: appliedFilters.productId.trim() || undefined,
        requestedByUserId: appliedFilters.requestedByUserId.trim() || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
      });

      setRows(response.items);
      setTotal(response.total);
      setTotalPages(Math.max(1, response.totalPages));
    } catch (caughtError) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, getAccessToken, limit, page]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (page <= totalPages) {
      return;
    }

    setPage(totalPages);
  }, [page, totalPages]);

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters({
      ...draftFilters,
      statusCsv: normalizeCsv(draftFilters.statusCsv),
    });
  };

  const onResetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const appliedStatusCsv = useMemo(
    () => normalizeCsv(appliedFilters.statusCsv),
    [appliedFilters.statusCsv],
  );

  const currentPageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const currentPageEnd = Math.min(total, page * limit);
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Requests"
        description="Live admin inventory requests with status/date/entity filters."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = normalizeCsv(draftFilters.statusCsv) === normalizeCsv(tab.value);
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  statusCsv: tab.value,
                }))
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-gray-900 text-white"
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            value={draftFilters.statusCsv}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, statusCsv: event.target.value }))
            }
            placeholder="status CSV (optional)"
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="text"
            value={draftFilters.branchId}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, branchId: event.target.value }))
            }
            placeholder="branchId"
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="text"
            value={draftFilters.productId}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, productId: event.target.value }))
            }
            placeholder="productId"
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="text"
            value={draftFilters.requestedByUserId}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, requestedByUserId: event.target.value }))
            }
            placeholder="requestedByUserId"
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="text"
            value={draftFilters.appointmentId}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, appointmentId: event.target.value }))
            }
            placeholder="appointmentId"
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="text"
            value={draftFilters.appointmentItemId}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, appointmentItemId: event.target.value }))
            }
            placeholder="appointmentItemId"
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="date"
            value={draftFilters.from}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, from: event.target.value }))
            }
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="date"
            value={draftFilters.to}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, to: event.target.value }))
            }
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApplyFilters}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">Rows per page</label>
            <select
              value={limit}
              onChange={(event) => {
                setPage(1);
                setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              }}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Inventory Requests</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {currentPageStart}-{currentPageEnd} of {total}
            {appliedStatusCsv ? ` · status=${appliedStatusCsv}` : ""}
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">Loading inventory requests...</div>
        ) : error ? (
          <div className="px-5 py-8 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                  <th className="px-5 py-3 font-medium">Request</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Requested By</th>
                  <th className="px-5 py-3 font-medium">Appointment</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-gray-700 dark:text-gray-300">{request.id}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(request.status)}`}>
                        {request.status || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                      <p>{request.branch?.name || "-"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{request.branch?.code || request.branchId || ""}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                      <p>{request.product?.name || "-"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{request.product?.sku || request.productId || ""}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {request.requestedByUser?.email || request.requestedByUserId || "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatDateTime(request.appointment?.appointmentDate)}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {formatDateTime(request.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {request.appointmentItem?.requestedSource || request.fromLocation || "-"}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                      No inventory requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrev}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={!canGoNext}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
