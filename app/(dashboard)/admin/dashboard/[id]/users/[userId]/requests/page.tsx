"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import {
  getAdminUserApprovalRequests,
  getAdminUserDetail,
  handleAccountAccessDeniedError,
  type AdminApprovalRequest,
  type AdminApprovalRequestStatus,
} from "@/lib/apiClient";
import {
  approvalStatusBadge,
  formatDateTime,
  getUserDetailDisplayName,
} from "@/lib/adminUiHelpers";
import supabase from "@/lib/supabase";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const RELATION_OPTIONS = ["ALL", "SUBMITTED", "TARGETED"] as const;
const STATUS_OPTIONS = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export default function AdminUserRequestsPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const userId = String(params.userId || "");

  const [name, setName] = useState("User");
  const [rows, setRows] = useState<AdminApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [relation, setRelation] = useState<(typeof RELATION_OPTIONS)[number]>("ALL");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("ALL");
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const [detail, requestsResponse] = await Promise.all([
        getAdminUserDetail({ accessToken, userId }),
        getAdminUserApprovalRequests({
          accessToken,
          userId,
          relation,
          status: status === "ALL" ? undefined : (status as AdminApprovalRequestStatus),
          page,
          limit,
        }),
      ]);

      setName(getUserDetailDisplayName(detail));
      setRows(requestsResponse.items);
      setTotal(requestsResponse.total);
      setTotalPages(Math.max(1, requestsResponse.totalPages));
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to load approval requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, limit, page, relation, status, userId]);

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
        title={`${name} Requests`}
        description="View all approval requests submitted by this user."
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_auto]">
          <select
            value={relation}
            onChange={(event) => {
              setPage(1);
              setRelation(event.target.value as (typeof RELATION_OPTIONS)[number]);
            }}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            {RELATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as (typeof STATUS_OPTIONS)[number]);
            }}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            {STATUS_OPTIONS.map((option) => (
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

      {/* Request History */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700/50 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Request History
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/40"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-5">
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200/60 dark:border-gray-700/40 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No requests found for the current filters.
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-900/40 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Requester</th>
                    <th className="px-5 py-3 font-medium">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDateTime(request.createdAt)}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {request.actionType}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${approvalStatusBadge(request.status)}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {request.requestedByUser?.email || request.requestedByUserId || "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {request.targetUser?.email || request.targetUserId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/30">
              {rows.map((request) => (
                <div key={request.id} className="px-4 py-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {request.actionType}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${approvalStatusBadge(request.status)}`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 dark:text-gray-500">From:</span>
                      <span className="text-gray-600 dark:text-gray-300 truncate">
                        {request.requestedByUser?.email || request.requestedByUserId || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 dark:text-gray-500">To:</span>
                      <span className="text-gray-600 dark:text-gray-300 truncate">
                        {request.targetUser?.email || request.targetUserId}
                      </span>
                    </div>
                    <div className="text-gray-400 dark:text-gray-500">
                      {formatDateTime(request.createdAt)}
                    </div>
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
