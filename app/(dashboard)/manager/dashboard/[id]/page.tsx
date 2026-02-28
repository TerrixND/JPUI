"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getManagerAnalyticsBranches,
  getManagerDashboard,
  getManagerDashboardSalespersons,
  type ManagerBranchAnalyticsRecord,
  type ManagerDashboardBranch,
} from "@/lib/managerApi";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const toPendingCount = (branch: ManagerDashboardBranch) =>
  branch.appointmentsByStatus
    .filter((entry) => entry.status === "REQUESTED" || entry.status === "PENDING")
    .reduce((sum, entry) => sum + entry.count, 0);

const toBranchActivity = (analytics: ManagerBranchAnalyticsRecord[]) => {
  return analytics
    .map((entry) => {
      const branchName = entry.branch?.name || entry.branch?.code || "Branch";
      const pending = entry.requestSummary.pending;
      const approved = entry.requestSummary.approved;
      const selected = entry.summary.selectedProductsCount;

      if (pending > 0) {
        return `${branchName}: ${pending} product request(s) pending approval.`;
      }

      if (approved > 0) {
        return `${branchName}: ${approved} product request(s) approved.`;
      }

      return `${branchName}: ${selected} selected product(s) currently active.`;
    })
    .slice(0, 8);
};

export default function ManagerDashboard() {
  const { dashboardBasePath } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [dashboardRows, setDashboardRows] = useState<ManagerDashboardBranch[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<ManagerBranchAnalyticsRecord[]>([]);
  const [salespersonCounts, setSalespersonCounts] = useState<Record<string, number>>({});

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    const accessToken = session?.access_token || "";
    if (!accessToken) throw new Error("Missing access token. Please sign in again.");
    return accessToken;
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const [dashboard, analytics, salespersons] = await Promise.all([
        getManagerDashboard({
          accessToken,
          branchId: branchFilter || undefined,
        }),
        getManagerAnalyticsBranches({
          accessToken,
          branchId: branchFilter || undefined,
        }),
        getManagerDashboardSalespersons({
          accessToken,
          branchId: branchFilter || undefined,
        }),
      ]);

      setDashboardRows(dashboard.branches);
      setAnalyticsRows(analytics.branches);
      setSalespersonCounts(salespersons.counts);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setDashboardRows([]);
      setAnalyticsRows([]);
      setSalespersonCounts({});
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [branchFilter, getAccessToken]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const branchOptions = useMemo(() => {
    const dedupe = new Map<string, string>();
    for (const branch of dashboardRows) {
      const label = [branch.code, branch.name].filter(Boolean).join(" · ") || branch.id;
      dedupe.set(branch.id, label);
    }
    return Array.from(dedupe.entries()).map(([id, label]) => ({ id, label }));
  }, [dashboardRows]);

  const totalBranches = dashboardRows.length;
  const totalPendingAppointments = dashboardRows.reduce(
    (sum, branch) => sum + toPendingCount(branch),
    0,
  );
  const activeSalespersons = salespersonCounts.ACTIVE ?? 0;
  const totalSalesAmount = dashboardRows.reduce(
    (sum, branch) => sum + branch.salesTotalAmount,
    0,
  );
  const totalPendingProductRequests = analyticsRows.reduce(
    (sum, row) => sum + row.requestSummary.pending,
    0,
  );

  const stats = [
    {
      label: "Managed Branches",
      value: String(totalBranches),
      accent: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
      href: `${dashboardBasePath}/salespersons`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: "Pending Appointments",
      value: String(totalPendingAppointments),
      accent: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
      href: `${dashboardBasePath}/appointments`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Active Salespersons",
      value: String(activeSalespersons),
      accent: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
      href: `${dashboardBasePath}/salespersons`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      label: "Tracked Sales Amount",
      value: money.format(totalSalesAmount),
      change:
        totalPendingProductRequests > 0
          ? `${totalPendingProductRequests} branch request(s) pending`
          : "No pending branch requests",
      up: totalPendingProductRequests === 0,
      accent: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      href: `${dashboardBasePath}/targeting`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const activityRows = toBranchActivity(analyticsRows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager Dashboard"
        description="Live branch operations, salesperson coverage, and request analytics."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              <option value="">All branches</option>
              {branchOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800"
              />
            ))
          : stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Branch Snapshot</h2>
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800"
              />
            ))
          ) : dashboardRows.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 text-sm text-gray-500 dark:text-gray-400">
              No branch records available in your manager scope.
            </div>
          ) : (
            dashboardRows.map((branch) => (
              <div
                key={branch.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {branch.name || "Unnamed Branch"}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {(branch.code && `${branch.code} · `) || ""}
                      {branch.city || "Unknown city"}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {branch.status || "UNKNOWN"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Members</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{branch.membershipsCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Appointments</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{branch.appointmentsCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Possessions</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{branch.productPossessionsCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Sales Count</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{branch.salesTotalCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Sales Amount</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {money.format(branch.salesTotalAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Branch Activity
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ))
            ) : activityRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No activity rows available for your branch scope.
              </p>
            ) : (
              activityRows.map((row, index) => (
                <div key={`${row}-${index}`} className="flex items-start gap-3">
                  <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">{row}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
