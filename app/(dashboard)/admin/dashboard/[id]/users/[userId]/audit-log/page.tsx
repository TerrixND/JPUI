"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  getAdminAuditLogs,
  getAdminUserDetail,
  handleAccountAccessDeniedError,
  type AdminAuditLogRow,
} from "@/lib/apiClient";
import {
  dedupeAuditRows,
  formatDateTime,
  formatRelativeTime,
  getUserDetailDisplayName,
} from "@/lib/adminUiHelpers";

const sortByCreatedAt = (rows: AdminAuditLogRow[]) =>
  [...rows].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });

export default function AdminUserAuditLogPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const userId = String(params.userId || "");

  const [name, setName] = useState("User");
  const [rows, setRows] = useState<AdminAuditLogRow[]>([]);
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
      const [detail, actorLogs, targetLogs] = await Promise.all([
        getAdminUserDetail({ accessToken, userId }),
        getAdminAuditLogs({ accessToken, actorUserId: userId, limit: 100 }),
        getAdminAuditLogs({ accessToken, entityId: userId, limit: 100 }),
      ]);

      setName(getUserDetailDisplayName(detail));
      setRows(
        sortByCreatedAt(
          dedupeAuditRows([...actorLogs.items, ...targetLogs.items]),
        ),
      );
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setRows([]);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const actorCount = useMemo(
    () => rows.filter((row) => row.actorId === userId).length,
    [rows, userId],
  );
  const targetCount = useMemo(
    () => rows.filter((row) => row.targetId === userId).length,
    [rows, userId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${name} Audit Log`}
        description="Combined actor and target history for the selected user."
        action={
          <Link
            href={`${dashboardBasePath}/users/${userId}`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to User Detail
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Total Rows
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {rows.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Actor Activity
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {actorCount}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Targeted Activity
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {targetCount}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Audit Timeline
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
              />
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-6 text-sm text-red-600 dark:text-red-300">{error}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">
            No audit activity found for this user.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Message</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {row.action}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.message || "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.actorEmail || row.actorId || "system"}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.targetId || row.targetType || "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      <div>{formatDateTime(row.createdAt)}</div>
                      <div className="text-xs">{formatRelativeTime(row.createdAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
