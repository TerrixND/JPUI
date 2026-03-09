"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import {
  getAdminUserAuditLogs,
  getAdminUserDetail,
  handleAccountAccessDeniedError,
  type AdminAuditLogRow,
} from "@/lib/apiClient";
import {
  formatDateTime,
  formatRelativeTime,
  getUserDetailDisplayName,
} from "@/lib/adminUiHelpers";
import supabase from "@/lib/supabase";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const SCOPE_OPTIONS = ["ALL", "ACTOR", "ENTITY"] as const;

export default function AdminUserAuditLogPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const userId = String(params.userId || "");

  const [name, setName] = useState("User");
  const [rows, setRows] = useState<AdminAuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<(typeof SCOPE_OPTIONS)[number]>("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

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
      const [detail, auditResponse] = await Promise.all([
        getAdminUserDetail({ accessToken, userId }),
        getAdminUserAuditLogs({
          accessToken,
          userId,
          scope,
          page,
          limit,
        }),
      ]);

      setName(getUserDetailDisplayName(detail));
      setRows(auditResponse.items);
      setTotal(auditResponse.total);
      setTotalPages(Math.max(1, auditResponse.totalPages));
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, limit, page, scope, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const totalStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const totalEnd = Math.min(total, page * limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${name} Audit Log`}
        description="Complete audit trail of actions involving this user."
        action={
          <Link
            href={`${dashboardBasePath}/users/${userId}`}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Back to User Detail
          </Link>
        }
      />

      {/* Filters & Controls */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={scope}
            onChange={(event) => {
              setPage(1);
              setScope(event.target.value as (typeof SCOPE_OPTIONS)[number]);
            }}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
            }}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>

          <div className="flex items-center px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-xl">
            {totalStart}-{totalEnd} of {total}
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700/50 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Audit Timeline
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/40"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-5">
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700/50 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No audit activity found for this user.
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/40 text-left text-gray-500 dark:text-gray-400">
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
                      className="border-b border-gray-100 dark:border-gray-700/30 last:border-0"
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

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/30">
              {rows.map((row) => (
                <div key={row.id} className="px-4 py-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.action}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(row.createdAt)}
                    </span>
                  </div>
                  {row.message && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {row.message}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      Actor: {row.actorEmail || row.actorId || "system"}
                    </span>
                    <span>
                      Target: {row.targetId || row.targetType || "-"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDateTime(row.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700/50 px-5 py-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
