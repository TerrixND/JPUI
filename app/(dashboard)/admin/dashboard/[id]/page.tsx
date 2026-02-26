"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  getAdminAuditLogs,
  getAdminBranchesWithManagers,
  getAdminInventoryRequests,
  getAdminUsers,
  type AdminAuditLogRow,
  type AdminBranchWithManagersRecord,
} from "@/lib/apiClient";

type ApiErrorPayload = {
  message?: string;
  code?: string;
  reason?: string;
};

type InventoryProfitSnapshot = {
  totals: {
    productCount: number;
    pricedProductCount: number;
    unpricedProductCount: number;
    projectedRevenueMin: number;
    projectedRevenueMax: number;
    projectedNetProfitMin: number;
    projectedNetProfitMax: number;
  };
};

type DashboardCounts = {
  activeUsers: number;
  branches: number;
  pendingRequests: number;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyRange = (min: number, max: number) => {
  if (min === max) return money.format(min);
  return `${money.format(min)} – ${money.format(max)}`;
};

const toErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  const message = payload?.message || fallback;
  const code = payload?.code ? ` (code: ${payload.code})` : "";
  const reason = payload?.reason ? ` (reason: ${payload.reason})` : "";
  return `${message}${code}${reason}`;
};

const getErrorMessage = (value: unknown, fallback: string) => {
  if (value instanceof Error) return value.message;
  return fallback;
};

const formatRelativeTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const toActivityDotColor = (action: string, index: number) => {
  const normalized = String(action || "").toUpperCase();
  if (normalized.includes("DELETE") || normalized.includes("REMOVE")) return "bg-red-400";
  if (normalized.includes("CREATE")) return "bg-emerald-400";
  if (normalized.includes("UPDATE") || normalized.includes("STATUS")) return "bg-blue-400";
  if (normalized.includes("APPROVE")) return "bg-purple-400";
  const fallback = ["bg-emerald-400", "bg-blue-400", "bg-purple-400", "bg-amber-400", "bg-gray-400"];
  return fallback[index % fallback.length];
};

const getBranchStatusBadge = (status: string | null) => {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "INACTIVE") return "bg-gray-100 text-gray-600";
  return "bg-gray-100 text-gray-500";
};

const getPrimaryManagerLabel = (branch: AdminBranchWithManagersRecord) => {
  const manager =
    branch.primaryManager ||
    branch.managers.find((entry) => entry.isPrimaryMembership) ||
    branch.managers[0];
  if (!manager) return "-";
  return manager.displayName || manager.email || manager.id;
};

function StatSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 bg-gray-200 rounded" />
        <div className="w-9 h-9 rounded-lg bg-gray-100" />
      </div>
      <div className="h-8 w-16 bg-gray-200 rounded mt-1" />
    </div>
  );
}

function BranchRowSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-3 px-5 py-3.5">
      <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-2.5 bg-gray-100 rounded w-1/4" />
      </div>
      <div className="h-5 w-14 bg-gray-100 rounded-full hidden sm:block" />
    </div>
  );
}

export default function AdminDashboard() {
  const { dashboardBasePath } = useRole();

  const [profitSnapshot, setProfitSnapshot] = useState<InventoryProfitSnapshot | null>(null);
  const [profitError, setProfitError] = useState("");
  const [profitLoading, setProfitLoading] = useState(true);

  const [counts, setCounts] = useState<DashboardCounts>({
    activeUsers: 0,
    branches: 0,
    pendingRequests: 0,
  });
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState("");

  const [branchRows, setBranchRows] = useState<AdminBranchWithManagersRecord[]>([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const [branchError, setBranchError] = useState("");

  const [recentActivity, setRecentActivity] = useState<AdminAuditLogRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

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

  const loadProjectedProfit = useCallback(async () => {
    setProfitLoading(true);
    setProfitError("");

    try {
      const accessToken = await getAccessToken();

      const response = await fetch("/api/v1/admin/analytics/inventory-profit?includeSold=true", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | InventoryProfitSnapshot
        | null;

      if (!response.ok) {
        throw new Error(
          toErrorMessage(payload as ApiErrorPayload | null, "Failed to load projected inventory profit."),
        );
      }

      setProfitSnapshot(payload as InventoryProfitSnapshot);
    } catch (caughtError) {
      setProfitSnapshot(null);
      setProfitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load projected inventory profit.",
      );
    } finally {
      setProfitLoading(false);
    }
  }, [getAccessToken]);

  const loadDashboardCountsAndBranches = useCallback(async () => {
    setCountsLoading(true);
    setCountsError("");
    setBranchLoading(true);
    setBranchError("");

    try {
      const accessToken = await getAccessToken();
      const [usersResult, branchesResult, pendingResult] = await Promise.allSettled([
        getAdminUsers({ accessToken, page: 1, limit: 1, accountStatus: "ACTIVE" }),
        getAdminBranchesWithManagers({ accessToken, page: 1, limit: 6, includeInactive: true }),
        getAdminInventoryRequests({
          accessToken,
          page: 1,
          limit: 1,
          status: ["PENDING_MANAGER", "PENDING_MAIN"],
        }),
      ]);

      const nextCounts = { activeUsers: 0, branches: 0, pendingRequests: 0 };
      const countErrors: string[] = [];

      if (usersResult.status === "fulfilled") {
        nextCounts.activeUsers = usersResult.value.total;
      } else {
        countErrors.push(getErrorMessage(usersResult.reason, "Failed to load active users count."));
      }

      if (branchesResult.status === "fulfilled") {
        nextCounts.branches = branchesResult.value.total;
        setBranchRows(branchesResult.value.items);
      } else {
        setBranchRows([]);
        const message = getErrorMessage(branchesResult.reason, "Failed to load branch network.");
        setBranchError(message);
        countErrors.push(message);
      }

      if (pendingResult.status === "fulfilled") {
        nextCounts.pendingRequests = pendingResult.value.total;
      } else {
        countErrors.push(getErrorMessage(pendingResult.reason, "Failed to load pending requests count."));
      }

      setCounts(nextCounts);
      setCountsError(countErrors.length ? countErrors.join(" ") : "");
    } catch (caughtError) {
      setCounts({ activeUsers: 0, branches: 0, pendingRequests: 0 });
      setCountsError(getErrorMessage(caughtError, "Failed to load dashboard summary."));
      setBranchRows([]);
      setBranchError(getErrorMessage(caughtError, "Failed to load branch network."));
    } finally {
      setCountsLoading(false);
      setBranchLoading(false);
    }
  }, [getAccessToken]);

  const loadRecentActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminAuditLogs({ accessToken, page: 1, limit: 8 });
      setRecentActivity(response.items);
    } catch (caughtError) {
      setRecentActivity([]);
      setActivityError(
        caughtError instanceof Error ? caughtError.message : "Failed to load recent activity.",
      );
    } finally {
      setActivityLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => { void loadProjectedProfit(); }, [loadProjectedProfit]);
  useEffect(() => { void loadDashboardCountsAndBranches(); }, [loadDashboardCountsAndBranches]);
  useEffect(() => { void loadRecentActivity(); }, [loadRecentActivity]);

  const t = profitSnapshot?.totals;

  const stats = useMemo(
    () => [
      {
        label: "Total Products",
        value: profitLoading ? null : (t ? t.productCount.toLocaleString() : "-"),
        accent: "bg-blue-50 text-blue-600 border-blue-100",
        bar: "bg-blue-500",
        href: `${dashboardBasePath}/products`,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        label: "Active Users",
        value: countsLoading ? null : counts.activeUsers.toLocaleString(),
        accent: "bg-emerald-50 text-emerald-600 border-emerald-100",
        bar: "bg-emerald-500",
        href: `${dashboardBasePath}/users`,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        ),
      },
      {
        label: "Branches",
        value: countsLoading ? null : counts.branches.toLocaleString(),
        accent: "bg-purple-50 text-purple-600 border-purple-100",
        bar: "bg-purple-500",
        href: `${dashboardBasePath}/branches`,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        label: "Pending Requests",
        value: countsLoading ? null : counts.pendingRequests.toLocaleString(),
        accent: "bg-amber-50 text-amber-600 border-amber-100",
        bar: "bg-amber-500",
        href: `${dashboardBasePath}/inventory`,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ),
      },
    ],
    [counts, countsLoading, profitLoading, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="System-wide overview of Jade Palace operations."
      />

      {countsError && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {countsError}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) =>
          s.value === null ? (
            <StatSkeleton key={s.label} />
          ) : (
            <Link
              key={s.label}
              href={s.href}
              className="relative bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-2 overflow-hidden transition-all hover:shadow-md group"
            >
              {/* Colored top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.bar}`} />
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors">{s.label}</p>
                <div className={`p-2 rounded-lg border ${s.accent}`}>{s.icon}</div>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{s.value}</p>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </Link>
          ),
        )}
      </div>

      {/* Projected Inventory Profit */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8M14 7h7v7" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Projected Inventory Profit</h2>
          </div>
          {!profitLoading && !profitError && (
            <button
              type="button"
              onClick={() => void loadProjectedProfit()}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </button>
          )}
        </div>

        {profitLoading && (
          <div className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-2.5 w-24 bg-gray-200 rounded" />
                  <div className="h-7 w-28 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!profitLoading && profitError && (
          <div className="px-5 py-8 text-center">
            <svg className="w-8 h-8 text-red-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-600">{profitError}</p>
            <button
              type="button"
              onClick={() => void loadProjectedProfit()}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!profitLoading && !profitError && t && (
          <div className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tracked Products</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1.5">{t.productCount.toLocaleString()}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[11px] text-gray-500">{t.pricedProductCount} priced</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-[11px] text-gray-400">{t.unpricedProductCount} unpriced</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Price Coverage</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1.5">
                  {t.productCount > 0
                    ? `${Math.round((t.pricedProductCount / t.productCount) * 100)}%`
                    : "0%"}
                </p>
                <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{
                      width: `${t.productCount > 0 ? (t.pricedProductCount / t.productCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Projected Revenue</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1.5 break-words">
                  {moneyRange(t.projectedRevenueMin, t.projectedRevenueMax)}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] text-purple-600 mt-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  Revenue range
                </span>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Projected Net Profit</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1.5 break-words">
                  {moneyRange(t.projectedNetProfitMin, t.projectedNetProfitMax)}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 mt-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
                  </svg>
                  Net profit range
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Branch Network + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Branch Network */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Branch Network</h2>
            {!countsLoading && (
              <span className="ml-auto text-[11px] text-gray-400 hidden sm:inline">
                {counts.branches} {counts.branches === 1 ? "branch" : "branches"}
              </span>
            )}
          </div>

          {branchLoading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, i) => (
                <BranchRowSkeleton key={i} />
              ))}
            </div>
          ) : branchError ? (
            <div className="px-5 py-10 text-center">
              <svg className="w-8 h-8 text-red-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-600">{branchError}</p>
            </div>
          ) : branchRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">No branches found.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wider bg-gray-50/60 border-b border-gray-100">
                      <th className="px-5 py-3 font-semibold">Branch</th>
                      <th className="px-5 py-3 font-semibold">City</th>
                      <th className="px-5 py-3 font-semibold">Primary Manager</th>
                      <th className="px-5 py-3 font-semibold">Managers</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {branchRows.map((branch) => (
                      <tr key={branch.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {branch.code || "--"}
                            </span>
                            <span className="font-medium text-gray-900">{branch.name || "Unnamed Branch"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{branch.city || "-"}</td>
                        <td className="px-5 py-3.5 text-gray-700 max-w-[140px] truncate">
                          {getPrimaryManagerLabel(branch)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{branch.managerCount}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${getBranchStatusBadge(branch.status)}`}
                          >
                            {branch.status || "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {branchRows.map((branch) => (
                  <div key={branch.id} className="px-4 py-3.5 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {branch.code || "--"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {branch.name || "Unnamed Branch"}
                        </p>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${getBranchStatusBadge(branch.status)}`}
                        >
                          {branch.status || "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        <span>{branch.city || "Unknown city"}</span>
                        <span>·</span>
                        <span>{branch.managerCount} mgr</span>
                        <span>·</span>
                        <span>{formatDate(branch.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Branch footer */}
          <div className="px-5 py-3 border-t border-gray-100 shrink-0 mt-auto">
            <Link
              href={`${dashboardBasePath}/branches`}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors group"
            >
              View all branches
              <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
            {!activityLoading && !activityError && (
              <button
                type="button"
                onClick={() => void loadRecentActivity()}
                className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                title="Refresh"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activityLoading ? (
              <div className="px-5 py-4 space-y-3.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="flex flex-col items-center pt-1.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-gray-200" />
                      {i < 4 && <div className="w-px flex-1 bg-gray-100 mt-1 min-h-[20px]" />}
                    </div>
                    <div className="flex-1 space-y-1.5 pb-3">
                      <div className="h-3 bg-gray-200 rounded w-4/5" />
                      <div className="h-2.5 bg-gray-100 rounded w-3/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityError ? (
              <div className="px-5 py-10 text-center">
                <svg className="w-8 h-8 text-red-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-red-600">{activityError}</p>
                <button
                  type="button"
                  onClick={() => void loadRecentActivity()}
                  className="mt-3 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-500">
                No recent audit activity found.
              </div>
            ) : (
              <div className="px-5 py-3 space-y-0.5">
                {recentActivity.map((item, index) => {
                  const target = item.targetId || item.targetType || "Record";
                  const actor = item.actorEmail || item.actorId || "system";
                  const timeLabel = formatRelativeTime(item.createdAt) || "recently";

                  return (
                    <div key={item.id} className="flex items-start gap-3 py-2.5">
                      <div className="flex flex-col items-center pt-1.5 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${toActivityDotColor(item.action, index)}`} />
                        {index < recentActivity.length - 1 && (
                          <span className="w-px flex-1 bg-gray-100 mt-1 min-h-[16px]" />
                        )}
                      </div>
                      <div className="min-w-0 pb-2 flex-1">
                        <p className="text-sm text-gray-700 leading-snug">
                          <span className="text-gray-400 text-xs">{item.action}</span>
                          {" "}
                          <span className="font-medium text-gray-900">{target}</span>
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{timeLabel} · {actor}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Logs link footer */}
          <div className="px-5 py-3 border-t border-gray-100 shrink-0">
            <Link
              href={`${dashboardBasePath}/logs`}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors group"
            >
              View full audit log
              <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
