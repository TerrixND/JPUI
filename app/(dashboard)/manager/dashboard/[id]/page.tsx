"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  filterManagerBranchStaff,
  getManagerAnalyticsBranches,
  getManagerBranchProductRequests,
  getManagerBranchUsers,
  getManagerPendingAppointments,
  type ManagerBranchAnalyticsRecord,
  type ManagerBranchProductRequestRecord,
  type ManagerBranchUser,
  type ManagerPendingAppointment,
} from "@/lib/managerApi";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const formatDateTime = (value: string | null) => {
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

const requestTone = (status: string | null) => {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "APPROVED":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    case "REJECTED":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    case "CANCELLED":
      return "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

const appointmentTone = (status: string | null) => {
  switch (status) {
    case "REQUESTED":
    case "PENDING":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "CONFIRMED":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    case "CANCELLED":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

const roleGroup = (rows: ManagerBranchUser[]) => {
  const staff = filterManagerBranchStaff(rows);
  return {
    branchAdmins: staff.filter(
      (row) => row.role === "MANAGER" && row.isPrimary,
    ),
    managers: staff.filter(
      (row) => row.role === "MANAGER" && !row.isPrimary,
    ),
    sales: staff.filter((row) => row.role === "SALES"),
  };
};

export default function ManagerDashboard() {
  const { dashboardBasePath } = useRole();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState("");
  const [analyticsRows, setAnalyticsRows] = useState<ManagerBranchAnalyticsRecord[]>([]);
  const [selectedAnalytics, setSelectedAnalytics] =
    useState<ManagerBranchAnalyticsRecord | null>(null);
  const [branchUsers, setBranchUsers] = useState<ManagerBranchUser[]>([]);
  const [appointments, setAppointments] = useState<ManagerPendingAppointment[]>([]);
  const [requestRows, setRequestRows] = useState<ManagerBranchProductRequestRecord[]>([]);

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

  const loadBranchScope = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const analytics = await getManagerAnalyticsBranches({ accessToken });
      setAnalyticsRows(analytics.branches);
      setBranchId((current) => current || analytics.branches[0]?.branch?.id || "");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setAnalyticsRows([]);
      setSelectedAnalytics(null);
      setBranchUsers([]);
      setAppointments([]);
      setRequestRows([]);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const loadBranchDetail = useCallback(
    async (nextBranchId: string) => {
      if (!nextBranchId) {
        setSelectedAnalytics(null);
        setBranchUsers([]);
        setAppointments([]);
        setRequestRows([]);
        return;
      }

      setDetailLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const [analytics, branchUsersResponse, appointmentRows, branchRequests] =
          await Promise.all([
            getManagerAnalyticsBranches({
              accessToken,
              branchId: nextBranchId,
            }),
            getManagerBranchUsers({
              accessToken,
              branchId: nextBranchId,
            }),
            getManagerPendingAppointments({
              accessToken,
              branchId: nextBranchId,
            }),
            getManagerBranchProductRequests({
              accessToken,
              branchId: nextBranchId,
              limit: 6,
            }),
          ]);

        setSelectedAnalytics(analytics.branches[0] || null);
        setBranchUsers(branchUsersResponse.users);
        setAppointments(appointmentRows);
        setRequestRows(branchRequests.records);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setSelectedAnalytics(null);
        setBranchUsers([]);
        setAppointments([]);
        setRequestRows([]);
        setError(getErrorMessage(caughtError));
      } finally {
        setDetailLoading(false);
      }
    },
    [getAccessToken],
  );

  useEffect(() => {
    void loadBranchScope();
  }, [loadBranchScope]);

  useEffect(() => {
    void loadBranchDetail(branchId);
  }, [branchId, loadBranchDetail]);

  const branchOptions = useMemo(
    () =>
      analyticsRows
        .map((row) => row.branch)
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((branch) => ({
          id: branch.id,
          label: [branch.code, branch.name].filter(Boolean).join(" · ") || branch.id,
        })),
    [analyticsRows],
  );

  const selectedBranch =
    selectedAnalytics?.branch ||
    analyticsRows.find((row) => row.branch?.id === branchId)?.branch ||
    null;
  const groupedStaff = roleGroup(branchUsers);
  const activeSalesCount = groupedStaff.sales.filter(
    (row) => row.status === "ACTIVE",
  ).length;
  const pendingRequests = selectedAnalytics?.requestSummary.pending ?? 0;
  const managedBranches = analyticsRows.length;
  const branchSummary = selectedAnalytics?.summary ?? null;

  const stats = [
    {
      label: "Managed Branches",
      value: String(managedBranches),
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
      value: String(appointments.length),
      accent: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
      href: `${dashboardBasePath}/appointments`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Active Salespeople",
      value: String(activeSalesCount),
      accent: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
      href: `${dashboardBasePath}/salespersons`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      label: "Selected Products",
      value: String(branchSummary?.selectedProductsCount ?? 0),
      change:
        pendingRequests > 0
          ? `${pendingRequests} request(s) pending approval`
          : "No pending branch product requests",
      up: pendingRequests === 0,
      accent: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      href: `${dashboardBasePath}/targeting`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager Dashboard"
        description="Branch-scoped operations built on the current manager API contract."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              <option value="">Select branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void loadBranchScope();
                if (branchId) {
                  void loadBranchDetail(branchId);
                }
              }}
              className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(16,185,129,0.08))] dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.35),rgba(6,78,59,0.18))] p-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
              Current Contract
            </p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
              Branch staff comes from <span className="font-semibold">/branch-users</span>.
              Branch admin is inferred as <span className="font-semibold">MANAGER + isPrimary</span>.
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Manager inventory flow currently means approve the appointment, create an
              inventory request, then allocate possession after upstream approval.
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              The manager API still does not expose a non-private product catalog or a customer
              finder route, so the product page stays honest about those gaps.
            </p>
          </div>
        </div>
      </div>

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

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">
                Focus Branch
              </p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {selectedBranch?.name || "Select a branch"}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {[selectedBranch?.code, selectedBranch?.city].filter(Boolean).join(" · ") ||
                  "Branch profile will appear here once a branch is selected."}
              </p>
            </div>
            {selectedBranch?.status && (
              <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                {selectedBranch.status}
              </span>
            )}
          </div>

          {detailLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4">
                <p className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Branch Admins
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {groupedStaff.branchAdmins.length}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Managers
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {groupedStaff.managers.length}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-[11px] uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Sales Team
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {groupedStaff.sales.length}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/70 p-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Pending Requests
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {pendingRequests}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Branch Value Range
              </h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">Sale range</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {branchSummary
                      ? `${money.format(branchSummary.totalSaleRangeMin)} - ${money.format(branchSummary.totalSaleRangeMax)}`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">Projected commission</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {branchSummary
                      ? `${money.format(branchSummary.totalCommissionRangeMin)} - ${money.format(branchSummary.totalCommissionRangeMax)}`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">Selected products</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {branchSummary?.selectedProductsCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Request Summary
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Pending", value: selectedAnalytics?.requestSummary.pending ?? 0 },
                  { label: "Approved", value: selectedAnalytics?.requestSummary.approved ?? 0 },
                  { label: "Rejected", value: selectedAnalytics?.requestSummary.rejected ?? 0 },
                  { label: "Cancelled", value: selectedAnalytics?.requestSummary.cancelled ?? 0 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-gray-50 dark:bg-gray-800/70 px-3 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Leadership Coverage
            </h3>
            <div className="mt-4 space-y-4">
              {[
                {
                  label: "Branch admins",
                  rows: groupedStaff.branchAdmins,
                  empty: "No primary manager flagged in current branch response.",
                },
                {
                  label: "Managers",
                  rows: groupedStaff.managers,
                  empty: "No additional managers assigned in this scope.",
                },
                {
                  label: "Sales team",
                  rows: groupedStaff.sales,
                  empty: "No sales memberships returned for this branch.",
                },
              ].map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                    {group.label}
                  </p>
                  {group.rows.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {group.empty}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.rows.slice(0, 8).map((row) => (
                        <span
                          key={row.membershipId}
                          className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700/60 px-3 py-1 text-xs text-gray-700 dark:text-gray-200"
                        >
                          {row.displayName || row.email || row.userId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Pending Appointments
            </h3>
            <div className="mt-4 space-y-3">
              {detailLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                  />
                ))
              ) : appointments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No pending appointments in the selected branch scope.
                </p>
              ) : (
                appointments.slice(0, 4).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {appointment.customerName || "Walk-in customer"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(appointment.appointmentDate)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${appointmentTone(
                          appointment.status,
                        )}`}
                      >
                        {appointment.status || "UNKNOWN"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Selected Product Snapshot
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Commission</th>
                  <th className="px-5 py-3 font-medium">Sale Range</th>
                  <th className="px-5 py-3 font-medium">Projected Range</th>
                </tr>
              </thead>
              <tbody>
                {detailLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      Loading product analytics...
                    </td>
                  </tr>
                ) : !selectedAnalytics || selectedAnalytics.selectedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                      No approved branch product selections in this scope.
                    </td>
                  </tr>
                ) : (
                  selectedAnalytics.selectedProducts.map((row, index) => (
                    <tr
                      key={`${row.allocationId || row.productId || "selected-product"}-${index}`}
                      className="border-b border-gray-50 dark:border-gray-800"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                        {row.productId || row.allocationId || "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-200">
                        {row.commissionRate ?? "-"}%
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {row.saleRangeMin !== null && row.saleRangeMax !== null
                          ? `${money.format(row.saleRangeMin)} - ${money.format(row.saleRangeMax)}`
                          : "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {row.projectedCommissionRangeMin !== null &&
                        row.projectedCommissionRangeMax !== null
                          ? `${money.format(row.projectedCommissionRangeMin)} - ${money.format(row.projectedCommissionRangeMax)}`
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Recent Branch Product Requests
            </h2>
          </div>
          <div className="p-5 space-y-3">
            {detailLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                />
              ))
            ) : requestRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No branch product requests found for this branch.
              </p>
            ) : (
              requestRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {row.id}
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {row.requestedProducts.length === 0
                          ? "No products attached"
                          : row.requestedProducts
                              .map((product) => product.sku || product.name || product.id)
                              .join(", ")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${requestTone(
                        row.status,
                      )}`}
                    >
                      {row.status || "UNKNOWN"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
