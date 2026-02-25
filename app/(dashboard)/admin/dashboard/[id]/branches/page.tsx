"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";
import supabase from "@/lib/supabase";
import {
  getAdminBranchesWithManagers,
  type AdminBranchStatus,
  type AdminBranchWithManagersRecord,
} from "@/lib/apiClient";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const ALL_FILTER = "__ALL__";

type Filters = {
  status: AdminBranchStatus | typeof ALL_FILTER;
  includeInactive: boolean;
};

const initialFilters: Filters = {
  status: ALL_FILTER,
  includeInactive: true,
};

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unexpected error.";
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const statusBadge = (status: string | null) => {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "INACTIVE") {
    return "bg-gray-200 text-gray-600";
  }

  return "bg-gray-100 text-gray-600";
};

const getPrimaryManagerLabel = (row: AdminBranchWithManagersRecord) => {
  const manager = row.primaryManager || row.managers.find((entry) => entry.isPrimaryMembership) || row.managers[0];
  if (!manager) {
    return "-";
  }

  return manager.displayName || manager.email || manager.id;
};

export default function AdminBranches() {
  const [rows, setRows] = useState<AdminBranchWithManagersRecord[]>([]);
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

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminBranchesWithManagers({
        accessToken,
        page,
        limit,
        status: appliedFilters.status !== ALL_FILTER ? appliedFilters.status : undefined,
        includeInactive: appliedFilters.includeInactive,
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
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (page <= totalPages) {
      return;
    }

    setPage(totalPages);
  }, [page, totalPages]);

  const totalManagersOnPage = useMemo(
    () => rows.reduce((sum, branch) => sum + Math.max(0, branch.managerCount), 0),
    [rows],
  );
  const activeBranchesOnPage = useMemo(
    () => rows.filter((branch) => branch.status === "ACTIVE").length,
    [rows],
  );
  const withPrimaryManagerOnPage = useMemo(
    () => rows.filter((branch) => Boolean(branch.primaryManager)).length,
    [rows],
  );

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const onResetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const currentPageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const currentPageEnd = Math.min(total, page * limit);
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const stats = [
    {
      label: "Total Branches",
      value: total.toLocaleString(),
      accent: "bg-purple-50 text-purple-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: "Active on Page",
      value: activeBranchesOnPage.toLocaleString(),
      accent: "bg-blue-50 text-blue-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      label: "Managers on Page",
      value: totalManagersOnPage.toLocaleString(),
      accent: "bg-emerald-50 text-emerald-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H9m0 0H4m5 0v-2a4 4 0 018 0v2zM12 12a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      ),
    },
    {
      label: "Primary Assigned",
      value: withPrimaryManagerOnPage.toLocaleString(),
      accent: "bg-amber-50 text-amber-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l2.118 6.52a1 1 0 00.95.69h6.857c.969 0 1.371 1.24.588 1.81l-5.547 4.03a1 1 0 00-.364 1.118l2.118 6.52c.3.921-.755 1.688-1.539 1.118l-5.547-4.03a1 1 0 00-1.176 0l-5.547 4.03c-.783.57-1.838-.197-1.539-1.118l2.118-6.52a1 1 0 00-.364-1.118L.536 11.947c-.783-.57-.38-1.81.588-1.81h6.857a1 1 0 00.95-.69l2.118-6.52z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Network"
        description="Live branch list with assigned managers and status filtering."
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={draftFilters.status}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                status: event.target.value as Filters["status"],
              }))
            }
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            <option value={ALL_FILTER}>All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <label className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
            <input
              type="checkbox"
              checked={draftFilters.includeInactive}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  includeInactive: event.target.checked,
                }))
              }
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Include inactive branches
          </label>

          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
            }}
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Branches</h2>
          <p className="text-xs text-gray-500">
            {currentPageStart}-{currentPageEnd} of {total}
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500">Loading branches...</div>
        ) : error ? (
          <div className="px-5 py-8 text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Primary Manager</th>
                  <th className="px-5 py-3 font-medium">Managers</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((branch) => (
                  <tr
                    key={branch.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{branch.name || "Unnamed Branch"}</p>
                      <p className="text-xs text-gray-500">{branch.code || branch.id}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{branch.city || "-"}</td>
                    <td className="px-5 py-3 text-gray-600">{getPrimaryManagerLabel(branch)}</td>
                    <td className="px-5 py-3 text-gray-600">{branch.managerCount}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(branch.status)}`}>
                        {branch.status || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(branch.updatedAt)}</td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                      No branches found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrev}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={!canGoNext}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
