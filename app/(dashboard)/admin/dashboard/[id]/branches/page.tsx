"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import {
  getAdminBranchAnalytics,
  handleAccountAccessDeniedError,
  type AdminBranchNetworkRecord,
  type AdminBranchStatus,
} from "@/lib/apiClient";
import supabase from "@/lib/supabase";

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

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatMoney = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return money.format(value);
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
    return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "INACTIVE") {
    return "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
  }

  return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";
};

const getPrimaryManagerLabel = (row: AdminBranchNetworkRecord) => {
  const manager =
    row.primaryManager || row.managers.find((entry) => entry.isPrimaryMembership) || row.managers[0];

  if (!manager) {
    return "-";
  }

  return manager.displayName || manager.email || manager.id;
};

export default function AdminBranches() {
  const { dashboardBasePath } = useRole();
  const [rows, setRows] = useState<AdminBranchNetworkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);

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
      const response = await getAdminBranchAnalytics({
        accessToken,
        status: appliedFilters.status !== ALL_FILTER ? appliedFilters.status : undefined,
        includeInactiveBranches: appliedFilters.includeInactive,
        rows: limit,
      });

      setRows(response.items);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setRows([]);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load branches.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, getAccessToken, limit]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const stats = useMemo(() => {
    const inventoryValue = rows.reduce((sum, row) => sum + (row.inventoryValue || 0), 0);
    const successfulSales = rows.reduce((sum, row) => sum + (row.successfulSalesCount || 0), 0);
    const totalUsers = rows.reduce((sum, row) => sum + (row.userCount || 0), 0);

    return [
      {
        label: "Visible Branches",
        value: rows.length.toLocaleString(),
        accent: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
        ),
      },
      {
        label: "Active Branches",
        value: rows.filter((row) => row.status === "ACTIVE").length.toLocaleString(),
        accent: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
      },
      {
        label: "Network Users",
        value: totalUsers.toLocaleString(),
        accent: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H9m0 0H4m5 0v-2a4 4 0 018 0v2zM12 12a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        ),
      },
      {
        label: "Inventory Value",
        value: formatMoney(inventoryValue),
        accent: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: "Successful Sales",
        value: successfulSales.toLocaleString(),
        accent: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
      },
    ];
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Network"
        description="Branch network analytics from the updated `/admin/analytics/branches` route."
      />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={draftFilters.status}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                status: event.target.value as Filters["status"],
              }))
            }
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            <option value={ALL_FILTER}>All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <label className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={draftFilters.includeInactive}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  includeInactive: event.target.checked,
                }))
              }
              className="rounded border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500"
            />
            Include inactive branches
          </label>

          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
            }}
            className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
            onClick={() => setAppliedFilters(draftFilters)}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftFilters(initialFilters);
              setAppliedFilters(initialFilters);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Branches</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{rows.length} branch row(s)</p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">Loading branches...</div>
        ) : error ? (
          <div className="px-5 py-8 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Primary Manager</th>
                  <th className="px-5 py-3 font-medium">Users</th>
                  <th className="px-5 py-3 font-medium">Inventory Value</th>
                  <th className="px-5 py-3 font-medium">Successful Sales</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((branch) => (
                  <tr
                    key={branch.id}
                    className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link href={`${dashboardBasePath}/branches/${branch.id}`} className="group">
                        <p className="font-medium text-gray-900 transition-colors group-hover:text-emerald-700 dark:text-gray-100 dark:group-hover:text-emerald-300">
                          {branch.name || "Unnamed Branch"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{branch.code || branch.id}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{branch.city || "-"}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{getPrimaryManagerLabel(branch)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{branch.userCount ?? "-"}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatMoney(branch.inventoryValue)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{branch.successfulSalesCount ?? "-"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(branch.status)}`}>
                        {branch.status || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDate(branch.updatedAt)}</td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                      No branches found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
