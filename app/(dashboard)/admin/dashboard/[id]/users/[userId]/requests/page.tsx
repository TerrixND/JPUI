"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  getAdminApprovalRequests,
  getAdminUserDetail,
  handleAccountAccessDeniedError,
  type AdminApprovalRequest,
} from "@/lib/apiClient";
import {
  approvalStatusBadge,
  formatDateTime,
  getUserDetailDisplayName,
} from "@/lib/adminUiHelpers";

type RequestScope = "REQUESTED_BY_USER" | "TARGETED_TO_USER";

const groupTitle: Record<RequestScope, string> = {
  REQUESTED_BY_USER: "Requested By User",
  TARGETED_TO_USER: "Targeted To User",
};

export default function AdminUserRequestsPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const userId = String(params.userId || "");

  const [name, setName] = useState("User");
  const [requestedByUser, setRequestedByUser] = useState<AdminApprovalRequest[]>([]);
  const [targetedToUser, setTargetedToUser] = useState<AdminApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeScope, setActiveScope] = useState<RequestScope>("TARGETED_TO_USER");

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
      const [detail, requestedResponse, targetedResponse] = await Promise.all([
        getAdminUserDetail({ accessToken, userId }),
        getAdminApprovalRequests({ accessToken, requestedByUserId: userId, limit: 100 }),
        getAdminApprovalRequests({ accessToken, targetUserId: userId, limit: 100 }),
      ]);

      setName(getUserDetailDisplayName(detail));
      setRequestedByUser(requestedResponse.items);
      setTargetedToUser(targetedResponse.items);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setRequestedByUser([]);
      setTargetedToUser([]);
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to load approval requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo(
    () => (activeScope === "REQUESTED_BY_USER" ? requestedByUser : targetedToUser),
    [activeScope, requestedByUser, targetedToUser],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${name} Requests`}
        description="Pending, approved, and rejected approval history for the selected user."
        action={
          <Link
            href={`${dashboardBasePath}/users/${userId}`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to User Detail
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Requested By User
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {requestedByUser.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Targeted To User
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {targetedToUser.length}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {groupTitle[activeScope]}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Separate request history flow from the user detail page.
            </p>
          </div>

          <div className="flex gap-2 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
            {(["TARGETED_TO_USER", "REQUESTED_BY_USER"] as RequestScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setActiveScope(scope)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  activeScope === scope
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {groupTitle[scope]}
              </button>
            ))}
          </div>
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
            No requests found for this scope.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
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
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {formatDateTime(request.createdAt)}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {request.actionType}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${approvalStatusBadge(request.status)}`}
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
        )}
      </div>
    </div>
  );
}
