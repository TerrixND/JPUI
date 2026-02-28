"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  getAdminApprovalRequests,
  getAdminUsers,
  handleAccountAccessDeniedError,
  type AdminAccountStatus,
  type AdminApprovalRequest,
  type AdminUserListItem,
  type AdminUserRole,
} from "@/lib/apiClient";
import {
  ADMIN_CAPABILITY_DEFINITIONS,
  type AdminCapabilityKey,
} from "@/lib/adminUiConfig";
import {
  accountStatusBadge,
  approvalStatusBadge,
  formatDateTime,
  getPrimaryBranchName,
  getUserDisplayName,
  roleBadge,
} from "@/lib/adminUiHelpers";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const ALL_FILTER = "__ALL__";

type Filters = {
  role: AdminUserRole | typeof ALL_FILTER;
  status: AdminAccountStatus | typeof ALL_FILTER;
  search: string;
};

type RequestActionType = "ADMIN_CAPABILITIES" | "RESTRICTION" | "BAN";

type RequestDraft = {
  actionType: RequestActionType;
  capabilities: AdminCapabilityKey[];
  reason: string;
  note: string;
  durationPreset: string;
  untilDate: string;
};

const initialFilters: Filters = {
  role: ALL_FILTER,
  status: ALL_FILTER,
  search: "",
};

const createDraft = (): RequestDraft => ({
  actionType: "RESTRICTION",
  capabilities: [],
  reason: "",
  note: "",
  durationPreset: "24h",
  untilDate: "",
});

export default function AdminUsersPage() {
  const { dashboardBasePath, isMainAdmin, userId } = useRole();

  const [rows, setRows] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [expandedUserId, setExpandedUserId] = useState("");
  const [requestDrafts, setRequestDrafts] = useState<Record<string, RequestDraft>>({});
  const [requestMessages, setRequestMessages] = useState<Record<string, string>>({});

  const [approvalRows, setApprovalRows] = useState<AdminApprovalRequest[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [approvalError, setApprovalError] = useState("");

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
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, getAccessToken, limit, page]);

  const loadApprovalQueue = useCallback(async () => {
    setApprovalLoading(true);
    setApprovalError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminApprovalRequests({
        accessToken,
        status: isMainAdmin ? "PENDING" : undefined,
        requestedByUserId: isMainAdmin ? undefined : userId,
        limit: 20,
      });
      setApprovalRows(response.items);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setApprovalRows([]);
      setApprovalError(
        caughtError instanceof Error ? caughtError.message : "Failed to load approval queue.",
      );
    } finally {
      setApprovalLoading(false);
    }
  }, [getAccessToken, isMainAdmin, userId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadApprovalQueue();
  }, [loadApprovalQueue]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const counts = useMemo(
    () => ({
      active: rows.filter((row) => row.status === "ACTIVE").length,
      admins: rows.filter((row) => row.role === "ADMIN").length,
      managers: rows.filter((row) => row.role === "MANAGER").length,
      sales: rows.filter((row) => row.role === "SALES").length,
    }),
    [rows],
  );

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const onResetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const updateDraft = (targetUserId: string, patch: Partial<RequestDraft>) => {
    setRequestDrafts((current) => ({
      ...current,
      [targetUserId]: {
        ...(current[targetUserId] || createDraft()),
        ...patch,
      },
    }));
  };

  const getDraftForUser = (targetUserId: string) => requestDrafts[targetUserId] || createDraft();

  const toggleCapability = (targetUserId: string, capability: AdminCapabilityKey) => {
    const currentDraft = getDraftForUser(targetUserId);
    const nextCapabilities = currentDraft.capabilities.includes(capability)
      ? currentDraft.capabilities.filter((entry) => entry !== capability)
      : [...currentDraft.capabilities, capability];

    updateDraft(targetUserId, {
      capabilities: nextCapabilities,
    });
  };

  const stageRequest = (row: AdminUserListItem) => {
    const draft = getDraftForUser(row.id);
    const restrictionDetails =
      draft.actionType === "ADMIN_CAPABILITIES" && draft.capabilities.length
        ? ` Limited: ${draft.capabilities.join(", ")}.`
        : "";

    setRequestMessages((current) => ({
      ...current,
      [row.id]: `${draft.actionType} request staged for ${getUserDisplayName(row)}.${restrictionDetails} Endpoint wiring pending.`,
    }));
  };

  const totalStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const totalEnd = Math.min(total, page * limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={
          isMainAdmin
            ? "Main admin flow routes into full User Settings."
            : "Admin flow stays on the users page with inline request forms only."
        }
      />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-200">
        This page now separates the two admin experiences: Main Admin opens full user settings,
        while Admin accounts stay in an inline snapshot and request flow.
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
        <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_180px]">
          <select
            value={draftFilters.role}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                role: event.target.value as Filters["role"],
              }))
            }
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-200"
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
              setDraftFilters((current) => ({
                ...current,
                status: event.target.value as Filters["status"],
              }))
            }
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-200"
          >
            <option value={ALL_FILTER}>All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RESTRICTED">RESTRICTED</option>
            <option value="BANNED">BANNED</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>

          <input
            value={draftFilters.search}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Search by name, email, or phone"
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-200"
          />

          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
            }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-200"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApplyFilters}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Results
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Active On Page
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{counts.active}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Admins
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{counts.admins}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Managers
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{counts.managers}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Sales
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{counts.sales}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isMainAdmin ? "User Settings Entry" : "User Snapshot Request Flow"}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {totalStart}-{totalEnd} of {total}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
              />
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-6 text-sm text-red-600 dark:text-red-300">{error}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">
            No users found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => {
              const isExpanded = expandedUserId === row.id;
              const draft = getDraftForUser(row.id);
              const isProtectedTarget = row.isMainAdmin && !isMainAdmin;

              return (
                <div key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {getUserDisplayName(row)}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleBadge(row.role, row.isMainAdmin)}`}
                        >
                          {row.isMainAdmin ? "MAIN ADMIN" : row.role || "-"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${accountStatusBadge(row.status)}`}
                        >
                          {row.status || "-"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                        {row.email || row.id}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Branch: {getPrimaryBranchName(row)} • Updated {formatDateTime(row.updatedAt)}
                      </p>
                    </div>

                    {isMainAdmin ? (
                      <Link
                        href={`${dashboardBasePath}/users/${row.id}`}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        Open User Settings
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedUserId((current) => (current === row.id ? "" : row.id))}
                        className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        {isExpanded ? "Hide Snapshot" : "Extend Snapshot"}
                      </button>
                    )}
                  </div>

                  {!isMainAdmin && isExpanded ? (
                    <div className="mt-4 space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Phone
                          </p>
                          <p className="mt-1">{row.phone || "-"}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Line ID
                          </p>
                          <p className="mt-1">{row.lineId || "-"}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            User ID
                          </p>
                          <p className="mt-1 font-mono">{row.id}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Joined
                          </p>
                          <p className="mt-1">{formatDateTime(row.createdAt)}</p>
                        </div>
                      </div>

                      {isProtectedTarget ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                          Main Admin accounts are protected from inline admin requests.
                        </div>
                      ) : (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                  Action Type
                                </label>
                                <select
                                  value={draft.actionType}
                                  onChange={(event) =>
                                    updateDraft(row.id, {
                                      actionType: event.target.value as RequestActionType,
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                >
                                  <option value="ADMIN_CAPABILITIES">Admin Capabilities</option>
                                  <option value="RESTRICTION">Restriction</option>
                                  <option value="BAN">Ban</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                  Duration
                                </label>
                                <select
                                  value={draft.durationPreset}
                                  onChange={(event) =>
                                    updateDraft(row.id, {
                                      durationPreset: event.target.value,
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                >
                                  <option value="1h">1 hour</option>
                                  <option value="4h">4 hours</option>
                                  <option value="12h">12 hours</option>
                                  <option value="24h">24 hours</option>
                                  <option value="custom">Custom date</option>
                                </select>
                              </div>
                            </div>

                            {draft.durationPreset === "custom" ? (
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                  Until Date
                                </label>
                                <input
                                  type="datetime-local"
                                  value={draft.untilDate}
                                  onChange={(event) =>
                                    updateDraft(row.id, {
                                      untilDate: event.target.value,
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                />
                              </div>
                            ) : null}

                            {draft.actionType === "ADMIN_CAPABILITIES" ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                  Capabilities To Restrict
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {ADMIN_CAPABILITY_DEFINITIONS.map((capability) => (
                                    <label
                                      key={capability.key}
                                      className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={draft.capabilities.includes(capability.key)}
                                        onChange={() => toggleCapability(row.id, capability.key)}
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span>
                                        <span className="block font-semibold">{capability.label}</span>
                                        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                                          {capability.helper}
                                        </span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                Reason
                              </label>
                              <input
                                value={draft.reason}
                                onChange={(event) =>
                                  updateDraft(row.id, {
                                    reason: event.target.value,
                                  })
                                }
                                placeholder="Reason for the request"
                                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                Note
                              </label>
                              <textarea
                                value={draft.note}
                                onChange={(event) =>
                                  updateDraft(row.id, {
                                    note: event.target.value,
                                  })
                                }
                                rows={3}
                                placeholder="Explain the context for main admin review"
                                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              Submit Request
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                              This panel mirrors the admin POV from your spec: snapshot only,
                              then restriction or ban request from the users page.
                            </p>
                            <button
                              type="button"
                              onClick={() => stageRequest(row)}
                              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                              Stage Request Flow
                            </button>
                            {requestMessages[row.id] ? (
                              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                                {requestMessages[row.id]}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700/60">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
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
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isMainAdmin ? "Approval Queue" : "My Requests"}
          </h2>
        </div>

        {approvalLoading ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
              />
            ))}
          </div>
        ) : approvalError ? (
          <div className="px-5 py-6 text-sm text-red-600 dark:text-red-300">{approvalError}</div>
        ) : approvalRows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">
            No approval requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Requester</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map((request) => (
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
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {request.targetUser?.email || request.targetUserId}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {request.requestedByUser?.email || request.requestedByUserId || "-"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${approvalStatusBadge(request.status)}`}
                      >
                        {request.status}
                      </span>
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
