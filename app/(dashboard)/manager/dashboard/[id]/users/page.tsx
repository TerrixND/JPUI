"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getManagerAnalyticsBranches,
  getManagerBranchUsers,
  type ManagerBranchUser,
} from "@/lib/managerApi";
import {
  formatManagerDateTime,
  getManagerUserLabel,
  managerStatusBadge,
} from "@/lib/managerDashboardUi";

const ROLE_FILTERS = ["ALL", "MANAGER", "SALES"] as const;

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

export default function ManagerUsersPage() {
  const { dashboardBasePath } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("ALL");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [users, setUsers] = useState<ManagerBranchUser[]>([]);

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

  const loadBranches = useCallback(async () => {
    const accessToken = await getAccessToken();
    const analytics = await getManagerAnalyticsBranches({ accessToken });
    const options = analytics.branches
      .map((row) => row.branch)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((branch) => ({
        id: branch.id,
        label: [branch.code, branch.name].filter(Boolean).join(" · ") || branch.id,
      }));

    setBranchOptions(options);
    setBranchId((current) => current || options[0]?.id || "");
    return options[0]?.id || "";
  }, [getAccessToken]);

  const loadUsers = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId) {
        setUsers([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const response = await getManagerBranchUsers({
          accessToken,
          branchId: resolvedBranchId,
        });
        setUsers(response.users);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setUsers([]);
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [branchId, getAccessToken],
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const firstBranchId = await loadBranches();
        await loadUsers(firstBranchId);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setBranchOptions([]);
        setUsers([]);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches, loadUsers]);

  useEffect(() => {
    if (branchId) {
      void loadUsers(branchId);
    }
  }, [branchId, loadUsers]);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const role = String(user.role || "").toUpperCase();
        if (role !== "MANAGER" && role !== "SALES") {
          return false;
        }

        if (roleFilter === "ALL") {
          return true;
        }

        return role === roleFilter;
      }),
    [roleFilter, users],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Branch user directory for managers and sales team members. Open a user to manage status, restrictions, and commission context."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-900"
            >
              <option value="">Select branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as (typeof ROLE_FILTERS)[number])
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-900"
            >
              {ROLE_FILTERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void loadBranches();
                void loadUsers(branchId);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Refresh
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Restrictions</th>
                <th className="px-5 py-3 font-medium">Commission Context</th>
                <th className="px-5 py-3 font-medium text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading branch users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No branch users matched the current filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.membershipId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {getManagerUserLabel(user)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.email || user.userId}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {user.role === "MANAGER" && user.isPrimary ? "BRANCH_ADMIN" : user.role || "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${managerStatusBadge(user.status)}`}
                      >
                        {user.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {user.accessRestrictionCount}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {user.role === "SALES"
                        ? `${user.commissionSummary.activeSalespersonPolicyCount} active policy`
                        : `Assigned ${formatManagerDateTime(user.assignedAt)}`}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`${dashboardBasePath}/users/${user.userId}?branchId=${branchId}`}
                        className="text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
