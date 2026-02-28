"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  getAdminAuditLogs,
  getAdminBranchesWithManagers,
  handleAccountAccessDeniedError,
  type AdminAuditLogRow,
} from "@/lib/apiClient";
import { formatDateTime } from "@/lib/adminUiHelpers";

export default function AdminBranchAuditLogPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const branchId = String(params.branchId || "");

  const [branchName, setBranchName] = useState("Branch");
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
      const [branchResponse, auditResponse] = await Promise.all([
        getAdminBranchesWithManagers({
          accessToken,
          page: 1,
          limit: 200,
          includeInactive: true,
        }),
        getAdminAuditLogs({
          accessToken,
          branchId,
          limit: 200,
        }),
      ]);

      const branch = branchResponse.items.find((item) => item.id === branchId);
      setBranchName(branch?.name || "Branch");
      setRows(auditResponse.items);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setRows([]);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load branch audit log.");
    } finally {
      setLoading(false);
    }
  }, [branchId, getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${branchName} Audit Log`}
        description="Dedicated audit page for the branch detail flow."
        action={
          <Link
            href={`${dashboardBasePath}/branches/${branchId}`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to Branch Detail
          </Link>
        }
      />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Audit Rows</h2>
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
            No audit rows found for this branch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDateTime(row.createdAt)}</td>
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{row.action}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.actorEmail || row.actorId || "system"}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.message || row.targetId || "-"}</td>
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
