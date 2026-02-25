"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import {
  getAdminUsers,
  type AdminAccountStatus,
  type AdminUserListItem,
  type AdminUserRole,
} from "@/lib/apiClient";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const ALL_FILTER = "__ALL__";

type Filters = {
  role: AdminUserRole | typeof ALL_FILTER;
  status: AdminAccountStatus | typeof ALL_FILTER;
  search: string;
};

const initialFilters: Filters = {
  role: ALL_FILTER,
  status: ALL_FILTER,
  search: "",
};

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unexpected error.";
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

function roleBadge(role: string | null) {
  switch (role) {
    case "ADMIN":
      return "bg-red-100 text-red-700";
    case "MANAGER":
      return "bg-amber-100 text-amber-700";
    case "SALES":
      return "bg-emerald-100 text-emerald-700";
    case "CUSTOMER":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function statusBadge(status: string | null) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";
    case "RESTRICTED":
      return "bg-yellow-100 text-yellow-700";
    case "BANNED":
      return "bg-red-100 text-red-600";
    case "SUSPENDED":
      return "bg-orange-100 text-orange-600";
    case "TERMINATED":
      return "bg-gray-200 text-gray-500";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

const getPrimaryBranchName = (user: AdminUserListItem) => {
  const primaryMembership = user.branchMemberships.find((membership) => membership.isPrimary);
  if (primaryMembership?.branch?.name) {
    return primaryMembership.branch.name;
  }

  const firstMembership = user.branchMemberships[0];
  if (firstMembership?.branch?.name) {
    return firstMembership.branch.name;
  }

  return "-";
};

export default function AdminUsers() {
  const [rows, setRows] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminUsers({
        accessToken,
        page,
        limit,
        role: appliedFilters.role !== ALL_FILTER ? appliedFilters.role : undefined,
        accountStatus: appliedFilters.status !== ALL_FILTER ? appliedFilters.status : undefined,
        search: appliedFilters.search.trim() || undefined,
      });

      setRows(response.items);
      setTotal(response.total);
      setTotalPages(Math.max(1, response.totalPages));
    } catch (caughtError) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, getAccessToken, limit, page]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (page <= totalPages) {
      return;
    }

    setPage(totalPages);
  }, [page, totalPages]);

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const onResetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const currentPageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const currentPageEnd = Math.min(total, page * limit);
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="View users across all roles and filter by account status."
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            value={draftFilters.search}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
            }
            placeholder="Search by email or user ID"
            className="lg:col-span-2 px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />

          <select
            value={draftFilters.role}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                role: event.target.value as Filters["role"],
              }))
            }
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            <option value={ALL_FILTER}>All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="SALES">SALES</option>
            <option value="CUSTOMER">CUSTOMER</option>
          </select>

          <select
            value={draftFilters.status}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                status: event.target.value as Filters["status"],
              }))
            }
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            <option value={ALL_FILTER}>All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RESTRICTED">RESTRICTED</option>
            <option value="BANNED">BANNED</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApplyFilters}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Rows per page</label>
            <select
              value={limit}
              onChange={(event) => {
                setPage(1);
                setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              }}
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Users</h2>
          <p className="text-xs text-gray-500">
            {currentPageStart}-{currentPageEnd} of {total}
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500">Loading users...</div>
        ) : error ? (
          <div className="px-5 py-8 text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Primary Branch</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">
                        {user.displayName || user.email || "Unknown User"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.email || user.id}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge(user.role)}`}
                      >
                        {user.role || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(user.status)}`}
                      >
                        {user.status || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {getPrimaryBranchName(user)}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrev}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={!canGoNext}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
