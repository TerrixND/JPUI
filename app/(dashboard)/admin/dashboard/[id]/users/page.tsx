"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import { ADMIN_ACTION_BLOCKS } from "@/lib/adminAccessControl";
import {
  createAdminUserBan,
  createAdminUserRestriction,
  decideAdminApprovalRequest,
  getAdminApprovalRequests,
  getAdminUsers,
  handleAccountAccessDeniedError,
  type AdminAccountStatus,
  type AdminActionBlock,
  type AdminApprovalRequest,
  type AdminRestrictionMode,
  type AdminUserListItem,
  type AdminUserRole,
} from "@/lib/apiClient";
import {
  accountStatusBadge,
  approvalStatusBadge,
  formatDateTime,
  getPrimaryBranchName,
  getUserDisplayName,
  roleBadge,
} from "@/lib/adminUiHelpers";
import supabase from "@/lib/supabase";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const ALL_FILTER = "__ALL__";
const DURATION_PRESETS = [
  { value: "1h", label: "1 hour", hours: 1 },
  { value: "4h", label: "4 hours", hours: 4 },
  { value: "12h", label: "12 hours", hours: 12 },
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "3d", label: "3 days", hours: 72 },
  { value: "7d", label: "7 days", hours: 168 },
  { value: "custom", label: "Custom", hours: null },
] as const;

type Filters = {
  role: AdminUserRole | typeof ALL_FILTER;
  status: AdminAccountStatus | typeof ALL_FILTER;
  search: string;
};

type InlineActionType = "RESTRICTION" | "BAN";
type DurationPreset = (typeof DURATION_PRESETS)[number]["value"];

type InlineRequestDraft = {
  actionType: InlineActionType;
  durationPreset: DurationPreset;
  untilDate: string;
  reason: string;
  note: string;
  restrictionMode: AdminRestrictionMode;
  adminActionBlocks: AdminActionBlock[];
};

type ApprovalDecisionDraft = {
  decisionNote: string;
  enableAutoApproveForFuture: boolean;
};

const initialFilters: Filters = {
  role: ALL_FILTER,
  status: ALL_FILTER,
  search: "",
};

const createInlineDraft = (): InlineRequestDraft => ({
  actionType: "RESTRICTION",
  durationPreset: "24h",
  untilDate: "",
  reason: "",
  note: "",
  restrictionMode: "ACCOUNT",
  adminActionBlocks: [],
});

const createDecisionDraft = (): ApprovalDecisionDraft => ({
  decisionNote: "",
  enableAutoApproveForFuture: false,
});

const ACTION_BLOCK_COPY: Record<AdminActionBlock, string> = {
  PRODUCT_CREATE: "Product Create",
  PRODUCT_EDIT: "Product Edit",
  PRODUCT_VISIBILITY_MANAGE: "Product Visibility",
  PRODUCT_DELETE: "Product Delete",
  INVENTORY_REQUEST_DECIDE: "Inventory Requests",
  USER_ACCESS_MANAGE: "User Access",
  APPROVAL_REVIEW: "Approval Review",
  STAFF_RULE_MANAGE: "Staff Rules",
  LOG_DELETE: "Log Delete",
};

const formatActionMessage = (
  label: string,
  response: { statusCode: number; message: string | null },
) => {
  if (response.statusCode === 202) {
    return response.message || `${label} submitted for main admin approval.`;
  }

  return response.message || `${label} applied successfully.`;
};

const toLocalIsoString = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Enter a valid date and time.");
  }

  return parsed.toISOString();
};

const resolveTimeWindow = (draft: InlineRequestDraft) => {
  const startsAt = new Date();
  const preset = DURATION_PRESETS.find((item) => item.value === draft.durationPreset);

  if (!preset) {
    throw new Error("Select a valid duration.");
  }

  if (preset.value === "custom") {
    if (!draft.untilDate) {
      throw new Error("Select the custom end date.");
    }

    const endsAt = toLocalIsoString(draft.untilDate);
    if (new Date(endsAt).getTime() <= startsAt.getTime()) {
      throw new Error("The end date must be in the future.");
    }

    return {
      startsAt: startsAt.toISOString(),
      endsAt,
    };
  }

  return {
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + (preset.hours || 0) * 60 * 60 * 1000).toISOString(),
  };
};

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
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, InlineRequestDraft>>({});
  const [inlineMessages, setInlineMessages] = useState<Record<string, string>>({});
  const [inlineBusyByUserId, setInlineBusyByUserId] = useState<Record<string, boolean>>({});

  const [approvalRows, setApprovalRows] = useState<AdminApprovalRequest[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [approvalError, setApprovalError] = useState("");
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, ApprovalDecisionDraft>>({});
  const [approvalBusyId, setApprovalBusyId] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");

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
        status: appliedFilters.status !== ALL_FILTER ? appliedFilters.status : undefined,
        role: appliedFilters.role !== ALL_FILTER ? appliedFilters.role : undefined,
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
        caughtError instanceof Error ? caughtError.message : "Failed to load approval requests.",
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

  const getInlineDraft = useCallback(
    (targetUserId: string) => inlineDrafts[targetUserId] || createInlineDraft(),
    [inlineDrafts],
  );
  const getApprovalDraft = useCallback(
    (requestId: string) => approvalDrafts[requestId] || createDecisionDraft(),
    [approvalDrafts],
  );

  const updateInlineDraft = (targetUserId: string, patch: Partial<InlineRequestDraft>) => {
    setInlineDrafts((current) => ({
      ...current,
      [targetUserId]: {
        ...(current[targetUserId] || createInlineDraft()),
        ...patch,
      },
    }));
  };

  const updateApprovalDraft = (requestId: string, patch: Partial<ApprovalDecisionDraft>) => {
    setApprovalDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] || createDecisionDraft()),
        ...patch,
      },
    }));
  };

  const toggleAdminActionBlock = (targetUserId: string, block: AdminActionBlock) => {
    const draft = getInlineDraft(targetUserId);
    const next = draft.adminActionBlocks.includes(block)
      ? draft.adminActionBlocks.filter((value) => value !== block)
      : [...draft.adminActionBlocks, block];

    updateInlineDraft(targetUserId, {
      adminActionBlocks: next,
    });
  };

  const submitInlineRequest = useCallback(
    async (row: AdminUserListItem) => {
      const draft = getInlineDraft(row.id);
      setInlineMessages((current) => ({
        ...current,
        [row.id]: "",
      }));
      setInlineBusyByUserId((current) => ({
        ...current,
        [row.id]: true,
      }));

      try {
        const accessToken = await getAccessToken();
        const { startsAt, endsAt } = resolveTimeWindow(draft);

        if (!draft.reason.trim()) {
          throw new Error("Reason is required.");
        }

        if (draft.actionType === "RESTRICTION") {
          if (
            draft.restrictionMode === "ADMIN_ACTIONS" &&
            draft.adminActionBlocks.length === 0
          ) {
            throw new Error("Select at least one admin action block.");
          }

          const response = await createAdminUserRestriction({
            accessToken,
            userId: row.id,
            reason: draft.reason.trim(),
            note: draft.note.trim() || null,
            startsAt,
            endsAt,
            restrictionMode: draft.restrictionMode,
            adminActionBlocks:
              draft.restrictionMode === "ADMIN_ACTIONS" ? draft.adminActionBlocks : undefined,
          });

          setInlineMessages((current) => ({
            ...current,
            [row.id]: formatActionMessage("Restriction", response),
          }));
        } else {
          const response = await createAdminUserBan({
            accessToken,
            userId: row.id,
            reason: draft.reason.trim(),
            note: draft.note.trim() || null,
            startsAt,
            endsAt,
          });

          setInlineMessages((current) => ({
            ...current,
            [row.id]: formatActionMessage("Ban", response),
          }));
        }

        await Promise.all([loadUsers(), loadApprovalQueue()]);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to submit the request.";

        setInlineMessages((current) => ({
          ...current,
          [row.id]: message,
        }));
      } finally {
        setInlineBusyByUserId((current) => ({
          ...current,
          [row.id]: false,
        }));
      }
    },
    [getAccessToken, getInlineDraft, loadApprovalQueue, loadUsers],
  );

  const decideRequest = useCallback(
    async (request: AdminApprovalRequest, decision: "APPROVE" | "REJECT") => {
      const draft = getApprovalDraft(request.id);
      setApprovalBusyId(request.id);
      setApprovalMessage("");

      try {
        const accessToken = await getAccessToken();
        const response = await decideAdminApprovalRequest({
          accessToken,
          requestId: request.id,
          decision,
          decisionNote: draft.decisionNote.trim() || undefined,
          enableAutoApproveForFuture:
            decision === "APPROVE" ? draft.enableAutoApproveForFuture : undefined,
        });

        setApprovalMessage(formatActionMessage(`Request ${decision.toLowerCase()}`, response));
        await Promise.all([loadUsers(), loadApprovalQueue()]);
      } catch (caughtError) {
        setApprovalMessage(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to decide the approval request.",
        );
      } finally {
        setApprovalBusyId("");
      }
    },
    [getAccessToken, getApprovalDraft, loadApprovalQueue, loadUsers],
  );

  const totalStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const totalEnd = Math.min(total, page * limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={
          isMainAdmin
            ? "Main admin opens full user settings and reviews pending approvals."
            : "Admin accounts use inline restriction and ban request flows from the user list."
        }
      />

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
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {counts.active}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Admins
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {counts.admins}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Managers
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {counts.managers}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Sales
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {counts.sales}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isMainAdmin ? "User Settings Entry" : "Inline Access Controls"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {totalStart}-{totalEnd} of {total}
          </p>
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
              const draft = getInlineDraft(row.id);
              const isProtectedTarget = row.isMainAdmin && !isMainAdmin;
              const inlineMessage = inlineMessages[row.id];

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
                        onClick={() =>
                          setExpandedUserId((current) => (current === row.id ? "" : row.id))
                        }
                        className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        {isExpanded ? "Hide Controls" : "Open Controls"}
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
                          Main admin accounts are protected from inline access-control requests.
                        </div>
                      ) : (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                  Action Type
                                </label>
                                <select
                                  value={draft.actionType}
                                  onChange={(event) =>
                                    updateInlineDraft(row.id, {
                                      actionType: event.target.value as InlineActionType,
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                >
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
                                    updateInlineDraft(row.id, {
                                      durationPreset: event.target.value as DurationPreset,
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                >
                                  {DURATION_PRESETS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {draft.durationPreset === "custom" ? (
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                  Ends At
                                </label>
                                <input
                                  type="datetime-local"
                                  value={draft.untilDate}
                                  onChange={(event) =>
                                    updateInlineDraft(row.id, {
                                      untilDate: event.target.value,
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                />
                              </div>
                            ) : null}

                            {draft.actionType === "RESTRICTION" ? (
                              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
                                <div>
                                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                    Restriction Mode
                                  </label>
                                  <select
                                    value={draft.restrictionMode}
                                    onChange={(event) =>
                                      updateInlineDraft(row.id, {
                                        restrictionMode: event.target.value as AdminRestrictionMode,
                                      })
                                    }
                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                                  >
                                    <option value="ACCOUNT">ACCOUNT</option>
                                    <option value="ADMIN_ACTIONS">ADMIN_ACTIONS</option>
                                  </select>
                                </div>

                                {draft.restrictionMode === "ADMIN_ACTIONS" ? (
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                      Blocked Admin Actions
                                    </p>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                      {ADMIN_ACTION_BLOCKS.map((block) => (
                                        <label
                                          key={block}
                                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-200"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={draft.adminActionBlocks.includes(block)}
                                            onChange={() => toggleAdminActionBlock(row.id, block)}
                                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                          />
                                          {ACTION_BLOCK_COPY[block]}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                Reason
                              </label>
                              <input
                                value={draft.reason}
                                onChange={(event) =>
                                  updateInlineDraft(row.id, {
                                    reason: event.target.value,
                                  })
                                }
                                placeholder="Reason for review"
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
                                  updateInlineDraft(row.id, {
                                    note: event.target.value,
                                  })
                                }
                                rows={3}
                                placeholder="Internal note for the approval trail"
                                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              Submit Request
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                              Restriction and ban requests now post directly to the updated user
                              management routes. A `202` response is treated as a submitted request.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                void submitInlineRequest(row);
                              }}
                              disabled={inlineBusyByUserId[row.id] === true}
                              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {inlineBusyByUserId[row.id] === true
                                ? "Submitting..."
                                : `Submit ${draft.actionType.toLowerCase()}`}
                            </button>
                            {inlineMessage ? (
                              <p
                                className={`mt-3 rounded-xl border px-3 py-3 text-sm ${
                                  inlineMessage.toLowerCase().includes("failed") ||
                                  inlineMessage.toLowerCase().includes("required") ||
                                  inlineMessage.toLowerCase().includes("valid")
                                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                                }`}
                              >
                                {inlineMessage}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isMainAdmin ? "Approval Queue" : "My Submitted Requests"}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isMainAdmin
                ? "Approve or reject pending requests. Product-related requests can still be inspected in their detail flows."
                : "Recent approval requests submitted by your admin account."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadApprovalQueue();
            }}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Refresh Queue
          </button>
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
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {approvalRows.map((request) => {
              const draft = getApprovalDraft(request.id);
              const isPending = request.status === "PENDING";

              return (
                <div key={request.id} className="px-5 py-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {request.actionType}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${approvalStatusBadge(request.status)}`}
                        >
                          {request.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Target: {request.targetUser?.email || request.targetUserId}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Requester: {request.requestedByUser?.email || request.requestedByUserId || "-"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Reason: {request.requestReason || "-"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Created {formatDateTime(request.createdAt)}
                      </p>
                    </div>

                    {isMainAdmin && isPending ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                        <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Decision Note
                        </label>
                        <textarea
                          value={draft.decisionNote}
                          onChange={(event) =>
                            updateApprovalDraft(request.id, {
                              decisionNote: event.target.value,
                            })
                          }
                          rows={3}
                          placeholder="Optional note for the decision trail"
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        />
                        <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={draft.enableAutoApproveForFuture}
                            onChange={(event) =>
                              updateApprovalDraft(request.id, {
                                enableAutoApproveForFuture: event.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Enable auto-approve for future requests
                        </label>
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void decideRequest(request, "APPROVE");
                            }}
                            disabled={approvalBusyId === request.id}
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {approvalBusyId === request.id ? "Saving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void decideRequest(request, "REJECT");
                            }}
                            disabled={approvalBusyId === request.id}
                            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {approvalBusyId === request.id ? "Saving..." : "Reject"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {approvalMessage ? (
          <div className="border-t border-gray-200 px-5 py-4 text-sm text-emerald-700 dark:border-gray-700/60 dark:text-emerald-300">
            {approvalMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
