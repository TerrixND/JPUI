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

  return (
    <div className="space-y-6">
      <PageHeader
        title={branch?.name || "Branch Detail"}
        description="Dedicated branch page backed by the updated `/admin/branches/:branchId` route."
        action={
          <Link
            href={`${dashboardBasePath}/branches`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to Branch Network
          </Link>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
        {loading || !branch ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {branch.status || "-"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {branch.city || "Unknown city"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Primary Manager: {branch.primaryManager?.displayName || branch.primaryManager?.email || "-"}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Branch Code
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{branch.code || "-"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Address
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{branch.address || "-"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Created
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{formatDate(branch.createdAt)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Updated
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{formatDateTime(branch.updatedAt)}</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Branch Users
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{metrics.userCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Inventory Value
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatMoney(metrics.inventoryValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Successful Sales
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{metrics.successfulSales ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Requests
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{metrics.requestCount ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Branch Users</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Member Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {branchUsers.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
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
                      {member.isPrimary ? " • Primary" : ""}
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
                    <td colSpan={4} className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">
                      No branch users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Audit</h2>
            <Link
              href={`${branchPath}/audit-log`}
              className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              View full log
            </Link>
          </div>

          <div className="px-5 py-4">
            {recentAuditLogs.length ? (
              <div className="space-y-4">
                {recentAuditLogs.map((row) => (
                  <div key={row.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700/60 dark:bg-gray-800/40">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {row.action}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {row.message || row.targetId || "No detail provided."}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No branch audit rows found.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
