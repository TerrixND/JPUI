"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import {
  getAdminBranchDetail,
  handleAccountAccessDeniedError,
  type AdminBranchDetailResponse,
} from "@/lib/apiClient";
import { formatDate, formatDateTime } from "@/lib/adminUiHelpers";
import supabase from "@/lib/supabase";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return money.format(value);
};

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/* ── Shared style tokens ── */
const cardClasses =
  "bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden";

const secondaryBtnClasses =
  "px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors";

const labelClasses =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500";

const skeletonClasses =
  "animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/40";

export default function AdminBranchDetailPage() {
  const params = useParams();
  const { dashboardBasePath, isMainAdmin } = useRole();
  const branchId = String(params.branchId || "");

  const [payload, setPayload] = useState<AdminBranchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminBranchDetail({
        accessToken,
        branchId,
      });

      setPayload(response);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setPayload(null);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load branch detail.");
    } finally {
      setLoading(false);
    }
  }, [branchId, getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const branch = payload?.branch || null;
  const analytics = payload?.analytics || null;
  const branchUsers = payload?.users || [];
  const recentAuditLogs = payload?.recentAuditLogs || [];
  const branchPath = `${dashboardBasePath}/branches/${branchId}`;

  const metrics = useMemo(
    () => ({
      userCount: branch?.userCount ?? asNumber(analytics?.userCount) ?? branchUsers.length,
      inventoryValue:
        branch?.inventoryValue ??
        asNumber(analytics?.inventoryValue) ??
        asNumber(analytics?.inventoryValueAmount),
      successfulSales:
        branch?.successfulSalesCount ??
        asNumber(analytics?.successfulSalesCount) ??
        asNumber(analytics?.successfulSales),
      requestCount:
        branch?.requestCount ?? asNumber(analytics?.requestCount) ?? asNumber(analytics?.requests),
    }),
    [analytics, branch, branchUsers.length],
  );

  /* ── Error state ── */
  if (!loading && error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Branch Detail"
          description="Branch metrics, team members, and recent audit activity."
          action={
            <Link href={`${dashboardBasePath}/branches`} className={secondaryBtnClasses}>
              Back to Branch Network
            </Link>
          }
        />
        <div className="flex flex-col items-center justify-center py-20">
          <div className={`${cardClasses} max-w-md w-full px-6 py-8 text-center`}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
              <svg className="h-6 w-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Something went wrong</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => void loadData()}
              className={`${secondaryBtnClasses} mt-5`}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Loading state ── */
  if (loading || !branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Branch Detail"
          description="Branch metrics, team members, and recent audit activity."
          action={
            <Link href={`${dashboardBasePath}/branches`} className={secondaryBtnClasses}>
              Back to Branch Network
            </Link>
          }
        />

        {/* Branch info skeleton */}
        <div className={cardClasses}>
          <div className="p-5">
            <div className="mb-5 flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`${skeletonClasses} h-6 w-24`} />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`${skeletonClasses} h-16`} />
              ))}
            </div>
          </div>
        </div>

        {/* Metric cards skeleton */}
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${cardClasses} p-5`}>
              <div className={`${skeletonClasses} mb-3 h-3 w-20`} />
              <div className={`${skeletonClasses} h-8 w-16`} />
            </div>
          ))}
        </div>

        {/* Table + audit skeleton */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className={cardClasses}>
            <div className="border-b border-gray-200/80 dark:border-gray-700/50 px-5 py-4">
              <div className={`${skeletonClasses} h-5 w-28`} />
            </div>
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`${skeletonClasses} h-14`} />
              ))}
            </div>
          </div>
          <div className={cardClasses}>
            <div className="border-b border-gray-200/80 dark:border-gray-700/50 px-5 py-4">
              <div className={`${skeletonClasses} h-5 w-24`} />
            </div>
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`${skeletonClasses} h-20`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main content ── */
  return (
    <div className="space-y-6">
      <PageHeader
        title={branch.name || "Branch Detail"}
        description="Branch metrics, team members, and recent audit activity."
        action={
          <Link href={`${dashboardBasePath}/branches`} className={secondaryBtnClasses}>
            Back to Branch Network
          </Link>
        }
      />

      {/* ── Branch info card ── */}
      <div className={cardClasses}>
        <div className="p-5">
          {/* Badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {branch.status || "-"}
            </span>
            <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
              {branch.city || "Unknown city"}
            </span>
            <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
              Manager: {branch.primaryManager?.displayName || branch.primaryManager?.email || "-"}
            </span>
          </div>

          {/* Detail fields */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900/50">
              <p className={labelClasses}>Branch Code</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">{branch.code || "-"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900/50">
              <p className={labelClasses}>Address</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">{branch.address || "-"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900/50">
              <p className={labelClasses}>Created</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(branch.createdAt)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900/50">
              <p className={labelClasses}>Updated</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">{formatDateTime(branch.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <div className={`${cardClasses} p-5`}>
          <p className={labelClasses}>Branch Users</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{metrics.userCount ?? 0}</p>
        </div>
        <div className={`${cardClasses} p-5`}>
          <p className={labelClasses}>Inventory Value</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatMoney(metrics.inventoryValue)}
          </p>
        </div>
        <div className={`${cardClasses} p-5`}>
          <p className={labelClasses}>Successful Sales</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{metrics.successfulSales ?? 0}</p>
        </div>
        <div className={`${cardClasses} p-5`}>
          <p className={labelClasses}>Requests</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{metrics.requestCount ?? 0}</p>
        </div>
      </div>

      {/* ── Users table + Audit sidebar ── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Branch Users section */}
        <section className={cardClasses}>
          <div className="border-b border-gray-200/80 dark:border-gray-700/50 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Branch Users</h2>
          </div>

          {/* Desktop table - hidden on mobile */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/80 bg-gray-50/80 text-left text-gray-500 dark:border-gray-700/50 dark:bg-gray-900/40 dark:text-gray-400">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Member Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {branchUsers.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100/80 last:border-0 dark:border-gray-700/30">
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">
                      {isMainAdmin ? (
                        <Link
                          href={`${dashboardBasePath}/users/${member.user.id}`}
                          className="font-semibold text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                        >
                          {member.user.displayName || member.user.email || member.user.id}
                        </Link>
                      ) : (
                        <span className="font-semibold">
                          {member.user.displayName || member.user.email || member.user.id}
                        </span>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">{member.user.email || member.user.id}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {member.memberRole || "-"}
                      {member.isPrimary ? " \u00B7 Primary" : ""}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {member.user.status || "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {formatDate(member.assignedAt)}
                    </td>
                  </tr>
                ))}
                {branchUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                      No branch users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile card view - visible only on mobile */}
          <div className="lg:hidden">
            {branchUsers.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No branch users found.
              </div>
            ) : (
              <div className="divide-y divide-gray-100/80 dark:divide-gray-700/30">
                {branchUsers.map((member) => (
                  <div key={member.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {isMainAdmin ? (
                          <Link
                            href={`${dashboardBasePath}/users/${member.user.id}`}
                            className="block truncate font-semibold text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                          >
                            {member.user.displayName || member.user.email || member.user.id}
                          </Link>
                        ) : (
                          <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                            {member.user.displayName || member.user.email || member.user.id}
                          </p>
                        )}
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {member.user.email || member.user.id}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
                        {member.user.status || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
                        {member.memberRole || "-"}{member.isPrimary ? " \u00B7 Primary" : ""}
                      </span>
                      <span>Assigned {formatDate(member.assignedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recent Audit sidebar */}
        <section className={cardClasses}>
          <div className="flex items-center justify-between gap-3 border-b border-gray-200/80 dark:border-gray-700/50 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Audit</h2>
            <Link
              href={`${branchPath}/audit-log`}
              className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              View full log
            </Link>
          </div>

          <div className="p-4">
            {recentAuditLogs.length ? (
              <div className="space-y-3">
                {recentAuditLogs.map((row) => (
                  <div key={row.id} className="rounded-xl bg-gray-50 p-3.5 dark:bg-gray-900/50">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {row.action}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {row.message || row.targetId || "No detail provided."}
                    </p>
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">No audit activity found.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
