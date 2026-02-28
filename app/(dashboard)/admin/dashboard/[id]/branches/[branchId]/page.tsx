"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  getAdminAuditLogs,
  getAdminBranchesWithManagers,
  getAdminInventoryRequests,
  handleAccountAccessDeniedError,
  type AdminAuditLogRow,
  type AdminBranchWithManagersRecord,
} from "@/lib/apiClient";
import {
  branchStatusBadge,
  formatDate,
  formatDateTime,
  getPrimaryManagerLabel,
} from "@/lib/adminUiHelpers";

type BranchMemberRow = {
  id: string;
  memberRole: string;
  assignedAt: string | null;
  isPrimary: boolean;
  user: {
    id: string;
    email: string | null;
    role: string | null;
    status: string | null;
    displayName: string;
  };
};

type BranchMemberApiRow = {
  id?: string;
  memberRole?: string;
  assignedAt?: string | null;
  isPrimary?: boolean;
  user?: {
    id?: string;
    email?: string | null;
    role?: string | null;
    status?: string | null;
    adminProfile?: { displayName?: string | null } | null;
    managerProfile?: { displayName?: string | null } | null;
    salespersonProfile?: { displayName?: string | null } | null;
    customerProfile?: { displayName?: string | null } | null;
  } | null;
};

const normalizeMemberRow = (row: BranchMemberApiRow): BranchMemberRow | null => {
  const userId = String(row.user?.id || "").trim();
  if (!userId) {
    return null;
  }

  return {
    id: String(row.id || `${userId}-${row.memberRole || "MEMBER"}`).trim(),
    memberRole: String(row.memberRole || row.user?.role || "MEMBER").trim().toUpperCase(),
    assignedAt: row.assignedAt || null,
    isPrimary: row.isPrimary === true,
    user: {
      id: userId,
      email: row.user?.email || null,
      role: row.user?.role || null,
      status: row.user?.status || null,
      displayName:
        row.user?.adminProfile?.displayName
        || row.user?.managerProfile?.displayName
        || row.user?.salespersonProfile?.displayName
        || row.user?.customerProfile?.displayName
        || row.user?.email
        || userId,
    },
  };
};

const activityDot = (index: number) => {
  const palette = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-fuchsia-500", "bg-gray-500"];
  return palette[index % palette.length];
};

export default function AdminBranchDetailPage() {
  const params = useParams();
  const { dashboardBasePath, isMainAdmin } = useRole();
  const branchId = String(params.branchId || "");

  const [branch, setBranch] = useState<AdminBranchWithManagersRecord | null>(null);
  const [members, setMembers] = useState<BranchMemberRow[]>([]);
  const [auditRows, setAuditRows] = useState<AdminAuditLogRow[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [fulfilledCount, setFulfilledCount] = useState(0);
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
      const [branchResponse, membersResponse, auditResponse, requestResponse] = await Promise.all([
        getAdminBranchesWithManagers({
          accessToken,
          page: 1,
          limit: 200,
          includeInactive: true,
        }),
        fetch(`/api/v1/admin/branches/${encodeURIComponent(branchId)}/members`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }).then(async (response) => {
          if (!response.ok) {
            return [] as BranchMemberApiRow[];
          }
          const payload = (await response.json().catch(() => [])) as BranchMemberApiRow[];
          return Array.isArray(payload) ? payload : [];
        }),
        getAdminAuditLogs({
          accessToken,
          branchId,
          limit: 12,
        }),
        getAdminInventoryRequests({
          accessToken,
          branchId,
          limit: 100,
        }),
      ]);

      const selectedBranch = branchResponse.items.find((item) => item.id === branchId) || null;
      if (!selectedBranch) {
        throw new Error("Branch not found.");
      }

      setBranch(selectedBranch);
      setMembers(
        membersResponse
          .map((row) => normalizeMemberRow(row))
          .filter((row): row is BranchMemberRow => Boolean(row)),
      );
      setAuditRows(auditResponse.items);
      setRequestCount(requestResponse.items.length);
      setFulfilledCount(
        requestResponse.items.filter((item) => item.status === "FULFILLED" || item.status === "APPROVED").length,
      );
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setBranch(null);
      setMembers([]);
      setAuditRows([]);
      setRequestCount(0);
      setFulfilledCount(0);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load branch detail.");
    } finally {
      setLoading(false);
    }
  }, [branchId, getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalManagers = useMemo(
    () => members.filter((member) => member.memberRole === "MANAGER").length || branch?.managerCount || 0,
    [branch?.managerCount, members],
  );

  const branchPath = `${dashboardBasePath}/branches/${branchId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={branch?.name || "Branch Detail"}
        description="Branch detail, analytics, users, and audit preview flow."
        action={
          <Link
            href={`${dashboardBasePath}/branches`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to Branch Network
          </Link>
        }
      />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-200">
        This page adds the missing branch flow from your spec. Inventory value and successful sales
        cards are present as UI targets and can be bound to the final analytics endpoints later.
      </div>

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
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${branchStatusBadge(branch.status)}`}>
                {branch.status || "-"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {branch.city || "Unknown city"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Primary Manager: {getPrimaryManagerLabel(branch)}
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
                  City
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{branch.city || "-"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Address
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{branch.address || "-"}</p>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Branch Admin
          </p>
          <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            {branch ? getPrimaryManagerLabel(branch) : "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Total Users
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{members.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Total Managers
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{totalManagers}</p>
        </div>
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-700/60 dark:bg-gray-800/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Inventory Value
          </p>
          <p className="mt-2 text-base font-semibold text-gray-500 dark:text-gray-400">Endpoint pending</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Successful Flow
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{fulfilledCount}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{requestCount} request row(s) loaded</p>
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
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">
                      {isMainAdmin ? (
                        <Link
                          href={`${dashboardBasePath}/users/${member.user.id}`}
                          className="font-semibold text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                        >
                          {member.user.displayName}
                        </Link>
                      ) : (
                        <span className="font-semibold">{member.user.displayName}</span>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">{member.user.email || member.user.id}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {member.memberRole}
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
                {!members.length ? (
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Branch Audit Preview</h2>
            <Link
              href={`${branchPath}/audit-log`}
              className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              View full log
            </Link>
          </div>

          <div className="px-5 py-4">
            {auditRows.length ? (
              <div className="space-y-4">
                {auditRows.map((row, index) => (
                  <div key={row.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${activityDot(index)}`} />
                      {index < auditRows.length - 1 ? (
                        <span className="mt-1 min-h-8 w-px bg-gray-200 dark:bg-gray-700" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-2">
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
