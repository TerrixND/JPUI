"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  banAdminUser,
  decideAdminApprovalRequest,
  getAdminApprovalRequests,
  getAdminUserDetail,
  getAdminUsers,
  handleAccountAccessDeniedError,
  type AdminAccountStatus,
  type AdminActionResponse,
  type AdminApprovalActionType,
  type AdminApprovalRequest,
  type AdminApprovalRequestStatus,
  type AdminUserDetail,
  type AdminUserAccessRestriction,
  type AdminUserListItem,
  type AdminUserRole,
  upsertAdminUserRestriction,
  updateAdminUserStatus,
} from "@/lib/apiClient";
import {
  ADMIN_ACTION_BLOCKS,
  getAdminActionRestrictionTooltip,
  type AdminActionBlock,
} from "@/lib/adminAccessControl";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const ALL_FILTER = "__ALL__";
const ALL_APPROVAL_STATUS = "__ALL__";
const ALL_APPROVAL_ACTION = "__ALL_ACTION__";

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

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toIso = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};

const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
};

const normalizeStatus = (value: string | null): AdminAccountStatus =>
  value === "ACTIVE" ||
  value === "RESTRICTED" ||
  value === "BANNED" ||
  value === "SUSPENDED" ||
  value === "TERMINATED"
    ? value
    : "ACTIVE";

const roleBadge = (role: string | null, isMainAdmin: boolean) => {
  if (isMainAdmin) return "bg-fuchsia-100 text-fuchsia-700";
  if (role === "ADMIN") return "bg-red-100 text-red-700";
  if (role === "MANAGER") return "bg-amber-100 text-amber-700";
  if (role === "SALES") return "bg-emerald-100 text-emerald-700";
  if (role === "CUSTOMER") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
};

const statusBadge = (status: string | null) => {
  if (status === "ACTIVE") return "bg-green-100 text-green-700";
  if (status === "RESTRICTED") return "bg-yellow-100 text-yellow-700";
  if (status === "BANNED") return "bg-red-100 text-red-600";
  if (status === "SUSPENDED") return "bg-orange-100 text-orange-600";
  if (status === "TERMINATED") return "bg-gray-200 text-gray-600";
  return "bg-gray-100 text-gray-600";
};

const approvalStatusBadge = (status: string | null) => {
  if (status === "PENDING") return "bg-amber-100 text-amber-700";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  if (status === "CANCELLED") return "bg-gray-200 text-gray-600";
  return "bg-gray-100 text-gray-600";
};

const formatApprovalAction = (value: string | null) => {
  if (value === "USER_STATUS_CHANGE") return "Status Change";
  if (value === "USER_RESTRICTION_UPSERT") return "Restriction";
  if (value === "USER_BAN") return "Ban";
  return value || "-";
};

const adminActionBlockLabels: Record<AdminActionBlock, string> = {
  PRODUCT_CREATE: "Product Create",
  PRODUCT_EDIT: "Product Edit",
  PRODUCT_DELETE: "Product Delete",
  INVENTORY_REQUEST_DECIDE: "Inventory Decision",
  USER_ACCESS_MANAGE: "User Access Manage",
  APPROVAL_REVIEW: "Approval Review",
  STAFF_RULE_MANAGE: "Staff Rule Manage",
};

const normalizeRestrictionMode = (value: unknown): "ACCOUNT" | "ADMIN_ACTIONS" =>
  String(value || "").trim().toUpperCase() === "ADMIN_ACTIONS"
    ? "ADMIN_ACTIONS"
    : "ACCOUNT";

const normalizeAdminActionBlocks = (value: unknown): AdminActionBlock[] => {
  const rawRows = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const dedupe = new Set<AdminActionBlock>();

  for (const raw of rawRows) {
    const normalized = String(raw || "").trim().toUpperCase() as AdminActionBlock;
    if (ADMIN_ACTION_BLOCKS.includes(normalized)) {
      dedupe.add(normalized);
    }
  }

  return Array.from(dedupe);
};

const getRestrictionModeFromControl = (
  control: AdminUserAccessRestriction,
): "ACCOUNT" | "ADMIN_ACTIONS" => {
  const metadata =
    control.metadata && typeof control.metadata === "object" && !Array.isArray(control.metadata)
      ? (control.metadata as Record<string, unknown>)
      : null;
  const raw = control.raw || null;

  return normalizeRestrictionMode(
    metadata?.restrictionMode ?? raw?.restrictionMode,
  );
};

const getAdminActionBlocksFromControl = (
  control: AdminUserAccessRestriction,
): AdminActionBlock[] => {
  const metadata =
    control.metadata && typeof control.metadata === "object" && !Array.isArray(control.metadata)
      ? (control.metadata as Record<string, unknown>)
      : null;
  const raw = control.raw || null;

  return normalizeAdminActionBlocks(
    metadata?.adminActionBlocks ??
      metadata?.actionBlocks ??
      raw?.adminActionBlocks ??
      raw?.actionBlocks,
  );
};

const getPrimaryBranchName = (user: AdminUserListItem) => {
  const primary = user.branchMemberships.find((item) => item.isPrimary);
  if (primary?.branch?.name) return primary.branch.name;
  const first = user.branchMemberships[0];
  return first?.branch?.name || "-";
};

export default function AdminUsers() {
  const { isMainAdmin, userId, isAdminActionBlocked } = useRole();

  const [rows, setRows] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [statusValue, setStatusValue] = useState<AdminAccountStatus>("ACTIVE");
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [restrictionId, setRestrictionId] = useState("");
  const [restrictionReason, setRestrictionReason] = useState("");
  const [restrictionNote, setRestrictionNote] = useState("");
  const [restrictionMode, setRestrictionMode] = useState<"ACCOUNT" | "ADMIN_ACTIONS">("ACCOUNT");
  const [restrictionActionBlocks, setRestrictionActionBlocks] = useState<AdminActionBlock[]>([]);
  const [restrictionStartsAt, setRestrictionStartsAt] = useState("");
  const [restrictionEndsAt, setRestrictionEndsAt] = useState("");
  const [restrictionSubmitting, setRestrictionSubmitting] = useState(false);

  const [banReason, setBanReason] = useState("");
  const [banNote, setBanNote] = useState("");
  const [banStartsAt, setBanStartsAt] = useState("");
  const [banEndsAt, setBanEndsAt] = useState("");
  const [banDurationHours, setBanDurationHours] = useState("24");
  const [banSubmitting, setBanSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [approvalRows, setApprovalRows] = useState<AdminApprovalRequest[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [approvalError, setApprovalError] = useState("");
  const [approvalPage, setApprovalPage] = useState(1);
  const [approvalTotalPages, setApprovalTotalPages] = useState(1);
  const [approvalTotal, setApprovalTotal] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState<
    AdminApprovalRequestStatus | typeof ALL_APPROVAL_STATUS
  >(isMainAdmin ? "PENDING" : ALL_APPROVAL_STATUS);
  const [approvalActionType, setApprovalActionType] = useState<
    AdminApprovalActionType | typeof ALL_APPROVAL_ACTION
  >(ALL_APPROVAL_ACTION);
  const [decidingId, setDecidingId] = useState("");

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
      if (handleAccountAccessDeniedError(caughtError)) return;
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, getAccessToken, limit, page]);

  const loadDetail = useCallback(
    async (userId: string) => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const accessToken = await getAccessToken();
        const response = await getAdminUserDetail({ accessToken, userId });
        setDetail(response);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) return;
        setDetail(null);
        setDetailError(getErrorMessage(caughtError));
      } finally {
        setDetailLoading(false);
      }
    },
    [getAccessToken],
  );

  const loadApprovalRequests = useCallback(async () => {
    setApprovalLoading(true);
    setApprovalError("");
    try {
      const accessToken = await getAccessToken();
      const response = await getAdminApprovalRequests({
        accessToken,
        page: approvalPage,
        limit: 20,
        status: approvalStatus !== ALL_APPROVAL_STATUS ? approvalStatus : undefined,
        actionType:
          approvalActionType !== ALL_APPROVAL_ACTION
            ? approvalActionType
            : undefined,
      });
      setApprovalRows(response.items);
      setApprovalTotal(response.total);
      setApprovalTotalPages(Math.max(1, response.totalPages));
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) return;
      setApprovalRows([]);
      setApprovalTotal(0);
      setApprovalTotalPages(1);
      setApprovalError(getErrorMessage(caughtError));
    } finally {
      setApprovalLoading(false);
    }
  }, [approvalActionType, approvalPage, approvalStatus, getAccessToken]);

  const applyActionResult = useCallback(
    async (result: AdminActionResponse, fallbackMessage: string) => {
      setActionError("");
      setMessage(result.message || fallbackMessage);
      await Promise.all([
        loadUsers(),
        selectedUserId ? loadDetail(selectedUserId) : Promise.resolve(),
        loadApprovalRequests(),
      ]);
    },
    [loadApprovalRequests, loadDetail, loadUsers, selectedUserId],
  );
  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedUserId("");
      return;
    }
    if (!selectedUserId || !rows.some((row) => row.id === selectedUserId)) {
      setSelectedUserId(rows[0].id);
    }
  }, [rows, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    void loadDetail(selectedUserId);
  }, [loadDetail, selectedUserId]);

  useEffect(() => {
    setApprovalStatus(isMainAdmin ? "PENDING" : ALL_APPROVAL_STATUS);
    setApprovalActionType(ALL_APPROVAL_ACTION);
    setApprovalPage(1);
  }, [isMainAdmin]);

  useEffect(() => {
    void loadApprovalRequests();
  }, [loadApprovalRequests]);

  useEffect(() => {
    if (approvalPage > approvalTotalPages) setApprovalPage(approvalTotalPages);
  }, [approvalPage, approvalTotalPages]);

  useEffect(() => {
    if (!detail) return;
    setStatusValue(normalizeStatus(detail.status));
    setStatusReason("");
    setRestrictionId("");
    setRestrictionReason("");
    setRestrictionNote("");
    setRestrictionMode("ACCOUNT");
    setRestrictionActionBlocks([]);
    setRestrictionStartsAt("");
    setRestrictionEndsAt("");
    setBanReason("");
    setBanNote("");
    setBanStartsAt("");
    setBanEndsAt("");
    setBanDurationHours("24");
    setActionError("");
    setMessage("");
  }, [detail]);

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const onResetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const isTargetProtected = detail?.isMainAdmin === true;
  const isSelfForNonMainAdmin = (targetUserId: string) =>
    !isMainAdmin && targetUserId === userId;
  const isOwnAccountViewRestricted =
    detail ? isSelfForNonMainAdmin(detail.id) : false;
  const userAccessManageBlocked = isAdminActionBlocked("USER_ACCESS_MANAGE");
  const approvalReviewBlocked = isAdminActionBlocked("APPROVAL_REVIEW");
  const userAccessTooltip = getAdminActionRestrictionTooltip("USER_ACCESS_MANAGE");
  const approvalReviewTooltip = getAdminActionRestrictionTooltip("APPROVAL_REVIEW");
  const userAccessActionDisabled = !detail || isTargetProtected || userAccessManageBlocked;

  const toggleRestrictionActionBlock = (action: AdminActionBlock) => {
    setRestrictionActionBlocks((current) =>
      current.includes(action)
        ? current.filter((entry) => entry !== action)
        : [...current, action],
    );
  };

  const onSubmitStatus = async () => {
    if (!detail) return;
    if (isSelfForNonMainAdmin(detail.id)) {
      setActionError("Non-main admin cannot change their own account status.");
      setMessage("");
      return;
    }
    if (userAccessManageBlocked) {
      setActionError(userAccessTooltip);
      setMessage("");
      return;
    }
    setStatusSubmitting(true);
    setActionError("");
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      const result = await updateAdminUserStatus({
        accessToken,
        userId: detail.id,
        status: statusValue,
        reason: statusReason.trim() || undefined,
      });
      await applyActionResult(result, "Status updated.");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) return;
      setActionError(getErrorMessage(caughtError));
    } finally {
      setStatusSubmitting(false);
    }
  };

  const onSubmitRestriction = async () => {
    if (!detail) return;
    if (isSelfForNonMainAdmin(detail.id)) {
      setActionError("Non-main admin cannot apply restrictions to their own account.");
      setMessage("");
      return;
    }
    if (userAccessManageBlocked) {
      setActionError(userAccessTooltip);
      setMessage("");
      return;
    }
    if (!restrictionId && !restrictionReason.trim()) {
      setActionError("Reason is required for a new restriction.");
      return;
    }
    if (
      restrictionMode === "ADMIN_ACTIONS" &&
      restrictionActionBlocks.length === 0
    ) {
      setActionError("Select at least one admin action block.");
      return;
    }
    setRestrictionSubmitting(true);
    setActionError("");
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      const result = await upsertAdminUserRestriction({
        accessToken,
        userId: detail.id,
        restrictionId: restrictionId || undefined,
        reason: restrictionReason.trim() || undefined,
        note: restrictionNote.trim() || undefined,
        restrictionMode,
        adminActionBlocks:
          restrictionMode === "ADMIN_ACTIONS"
            ? restrictionActionBlocks
            : undefined,
        startsAt: toIso(restrictionStartsAt),
        endsAt: restrictionEndsAt ? toIso(restrictionEndsAt) : undefined,
        isActive: true,
      });
      await applyActionResult(result, "Restriction saved.");
      setRestrictionId("");
      setRestrictionReason("");
      setRestrictionNote("");
      setRestrictionMode("ACCOUNT");
      setRestrictionActionBlocks([]);
      setRestrictionStartsAt("");
      setRestrictionEndsAt("");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) return;
      setActionError(getErrorMessage(caughtError));
    } finally {
      setRestrictionSubmitting(false);
    }
  };

  const onSubmitBan = async () => {
    if (!detail) return;
    if (isSelfForNonMainAdmin(detail.id)) {
      setActionError("Non-main admin cannot ban their own account.");
      setMessage("");
      return;
    }
    if (userAccessManageBlocked) {
      setActionError(userAccessTooltip);
      setMessage("");
      return;
    }
    if (!banReason.trim()) {
      setActionError("Ban reason is required.");
      return;
    }
    setBanSubmitting(true);
    setActionError("");
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      const parsedDuration = banDurationHours.trim() ? Number(banDurationHours) : undefined;
      const result = await banAdminUser({
        accessToken,
        userId: detail.id,
        reason: banReason,
        note: banNote.trim() || undefined,
        startsAt: toIso(banStartsAt),
        endsAt: banEndsAt ? toIso(banEndsAt) : undefined,
        durationHours:
          parsedDuration !== undefined && Number.isFinite(parsedDuration) && parsedDuration > 0
            ? parsedDuration
            : undefined,
      });
      await applyActionResult(result, "Ban applied.");
      setBanReason("");
      setBanNote("");
      setBanStartsAt("");
      setBanEndsAt("");
      setBanDurationHours("24");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) return;
      setActionError(getErrorMessage(caughtError));
    } finally {
      setBanSubmitting(false);
    }
  };

  const onDecideRequest = async (request: AdminApprovalRequest, decision: "APPROVE" | "REJECT") => {
    if (approvalReviewBlocked) {
      setActionError(approvalReviewTooltip);
      setMessage("");
      return;
    }
    const note = window.prompt(`Optional note for ${decision.toLowerCase()}`, "");
    if (note === null) return;
    setDecidingId(request.id);
    setActionError("");
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      const result = await decideAdminApprovalRequest({
        accessToken,
        requestId: request.id,
        decision,
        note: note.trim() || undefined,
      });
      await applyActionResult(result, decision === "APPROVE" ? "Request approved." : "Request rejected.");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) return;
      setActionError(getErrorMessage(caughtError));
    } finally {
      setDecidingId("");
    }
  };

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const approvalCanGoPrev = approvalPage > 1;
  const approvalCanGoNext = approvalPage < approvalTotalPages;

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Manage users and approval requests." />

      {(message || actionError) && (
        <div className={`px-4 py-3 rounded-lg border text-sm ${actionError ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {actionError || message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input value={draftFilters.search} onChange={(e) => setDraftFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search by email or user ID" className="lg:col-span-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg" />
              <select value={draftFilters.role} onChange={(e) => setDraftFilters((p) => ({ ...p, role: e.target.value as Filters["role"] }))} className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg">
                <option value={ALL_FILTER}>All Roles</option><option value="ADMIN">ADMIN</option><option value="MANAGER">MANAGER</option><option value="SALES">SALES</option><option value="CUSTOMER">CUSTOMER</option>
              </select>
              <select value={draftFilters.status} onChange={(e) => setDraftFilters((p) => ({ ...p, status: e.target.value as Filters["status"] }))} className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg">
                <option value={ALL_FILTER}>All Statuses</option><option value="ACTIVE">ACTIVE</option><option value="RESTRICTED">RESTRICTED</option><option value="BANNED">BANNED</option><option value="SUSPENDED">SUSPENDED</option><option value="TERMINATED">TERMINATED</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={onApplyFilters} className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg">Apply Filters</button>
                <button onClick={onResetFilters} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg">Reset</button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Rows per page</label>
                <select value={limit} onChange={(e) => { setPage(1); setLimit(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]); }} className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg">
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 text-sm text-gray-600">{loading ? "Loading users..." : `${rows.length} loaded . total ${total}`}</div>
            {error ? <div className="px-5 py-6 text-sm text-red-600">{error}</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-200"><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Joined</th></tr></thead>
                  <tbody>
                    {rows.map((user) => (
                      <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className={`border-b border-gray-50 cursor-pointer ${selectedUserId === user.id ? "bg-emerald-50/50" : "hover:bg-gray-50"}`}>
                        <td className="px-5 py-3"><p className="font-medium text-gray-900">{user.displayName || user.email || "Unknown User"}</p><p className="text-xs text-gray-500">{user.email || user.id}</p></td>
                        <td className="px-5 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(user.role, user.isMainAdmin)}`}>{user.isMainAdmin ? "MAIN ADMIN" : user.role || "-"}</span></td>
                        <td className="px-5 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(user.status)}`}>{user.status || "-"}</span></td>
                        <td className="px-5 py-3 text-gray-600">{getPrimaryBranchName(user)}</td>
                        <td className="px-5 py-3 text-gray-500">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No users found.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canGoPrev} className="px-3 py-1.5 text-xs bg-gray-100 rounded-md disabled:opacity-50">Prev</button>
              <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!canGoNext} className="px-3 py-1.5 text-xs bg-gray-100 rounded-md disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isOwnAccountViewRestricted ? (
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <h2 className="text-base font-semibold text-amber-800">
                Self Account View Limited
              </h2>
              <p className="mt-2 text-sm text-amber-700">
                Non-main admins cannot view or apply restriction/ban/status controls on their own account.
              </p>
            </div>
          ) : (
            <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">User Detail</h2>
            {detailLoading ? <p className="text-sm text-gray-500">Loading detail...</p> : detailError ? <p className="text-sm text-red-600">{detailError}</p> : !detail ? <p className="text-sm text-gray-400">Select a user.</p> : (
              <>
                <p className="font-medium text-gray-900">{detail.email || detail.id}</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(detail.role, detail.isMainAdmin)}`}>{detail.isMainAdmin ? "MAIN ADMIN" : detail.role || "-"}</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(detail.status)}`}>{detail.status || "-"}</span>
                </div>
                <p className="text-xs text-gray-500">Active controls: {detail.activeAccessControlsCount}</p>
                <p className="text-xs text-gray-500">Joined: {formatDate(detail.createdAt)}</p>
                {isTargetProtected && <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1">Main admin target is protected. Actions are disabled.</p>}
                {userAccessManageBlocked && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">{userAccessTooltip}</p>}
                {approvalReviewBlocked && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">{approvalReviewTooltip}</p>}
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Status</h3>
            <select value={statusValue} onChange={(e) => setStatusValue(e.target.value as AdminAccountStatus)} disabled={userAccessActionDisabled || statusSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg">
              <option value="ACTIVE">ACTIVE</option><option value="RESTRICTED">RESTRICTED</option><option value="BANNED">BANNED</option><option value="SUSPENDED">SUSPENDED</option><option value="TERMINATED">TERMINATED</option>
            </select>
            <input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Reason (optional)" disabled={userAccessActionDisabled || statusSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg" />
            <button onClick={() => void onSubmitStatus()} disabled={userAccessActionDisabled || statusSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg disabled:opacity-50">{statusSubmitting ? "Submitting..." : isMainAdmin ? "Apply Status" : "Submit Status Request"}</button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Restriction</h3>
            <input
              value={restrictionId}
              onChange={(e) => setRestrictionId(e.target.value)}
              placeholder="restrictionId (optional for edit)"
              disabled={userAccessActionDisabled || restrictionSubmitting}
              title={userAccessManageBlocked ? userAccessTooltip : undefined}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg"
            />
            <input
              value={restrictionReason}
              onChange={(e) => setRestrictionReason(e.target.value)}
              placeholder="Reason"
              disabled={userAccessActionDisabled || restrictionSubmitting}
              title={userAccessManageBlocked ? userAccessTooltip : undefined}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg"
            />
            <input
              value={restrictionNote}
              onChange={(e) => setRestrictionNote(e.target.value)}
              placeholder="Note (optional)"
              disabled={userAccessActionDisabled || restrictionSubmitting}
              title={userAccessManageBlocked ? userAccessTooltip : undefined}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg"
            />
            <select
              value={restrictionMode}
              onChange={(e) => {
                const nextMode =
                  e.target.value === "ADMIN_ACTIONS" ? "ADMIN_ACTIONS" : "ACCOUNT";
                setRestrictionMode(nextMode);
                if (nextMode === "ACCOUNT") {
                  setRestrictionActionBlocks([]);
                }
              }}
              disabled={userAccessActionDisabled || restrictionSubmitting}
              title={userAccessManageBlocked ? userAccessTooltip : undefined}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg"
            >
              <option value="ACCOUNT">ACCOUNT</option>
              <option value="ADMIN_ACTIONS">ADMIN_ACTIONS</option>
            </select>
            {restrictionMode === "ADMIN_ACTIONS" && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Admin Action Blocks
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {ADMIN_ACTION_BLOCKS.map((action) => (
                    <label key={action} className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={restrictionActionBlocks.includes(action)}
                        onChange={() => toggleRestrictionActionBlock(action)}
                        disabled={userAccessActionDisabled || restrictionSubmitting}
                        title={userAccessManageBlocked ? userAccessTooltip : undefined}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{adminActionBlockLabels[action]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                value={restrictionStartsAt}
                onChange={(e) => setRestrictionStartsAt(e.target.value)}
                disabled={userAccessActionDisabled || restrictionSubmitting}
                title={userAccessManageBlocked ? userAccessTooltip : undefined}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg"
              />
              <input
                type="datetime-local"
                value={restrictionEndsAt}
                onChange={(e) => setRestrictionEndsAt(e.target.value)}
                disabled={userAccessActionDisabled || restrictionSubmitting}
                title={userAccessManageBlocked ? userAccessTooltip : undefined}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg"
              />
            </div>
            <button
              onClick={() => void onSubmitRestriction()}
              disabled={userAccessActionDisabled || restrictionSubmitting}
              title={userAccessManageBlocked ? userAccessTooltip : undefined}
              className="w-full px-3 py-2 text-sm text-white bg-amber-600 rounded-lg disabled:opacity-50"
            >
              {restrictionSubmitting
                ? "Submitting..."
                : isMainAdmin
                  ? "Save Restriction"
                  : "Submit Restriction Request"}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Restriction History</h3>
            {detail?.accessRestrictions?.length ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detail.accessRestrictions.slice(0, 12).map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge(item.isActive ? "ACTIVE" : "TERMINATED")}`}>
                        {item.type} . {item.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                      <button
                        type="button"
                        disabled={isTargetProtected || userAccessManageBlocked}
                        title={userAccessManageBlocked ? userAccessTooltip : undefined}
                        onClick={() => {
                          setRestrictionId(item.id);
                          setRestrictionReason(item.reason || "");
                          setRestrictionNote(item.note || "");
                          setRestrictionMode(getRestrictionModeFromControl(item));
                          setRestrictionActionBlocks(
                            getAdminActionBlocksFromControl(item),
                          );
                          setRestrictionStartsAt(toLocalInput(item.startsAt));
                          setRestrictionEndsAt(toLocalInput(item.endsAt));
                        }}
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                      >
                        Load
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{item.reason || "-"}</p>
                    <p className="text-[11px] text-gray-500">
                      {formatDateTime(item.startsAt)} to {formatDateTime(item.endsAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No restrictions found.</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Active Access Controls</h3>
            {detail?.activeAccessControls?.length ? (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {detail.activeAccessControls.map((item) => {
                  const mode = getRestrictionModeFromControl(item);
                  const blocks = getAdminActionBlocksFromControl(item);

                  return (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                      <p className="text-[11px] font-semibold text-gray-700">
                        {item.type} . {mode}
                      </p>
                      {blocks.length > 0 && (
                        <p className="mt-1 text-[11px] text-gray-600">
                          {blocks.map((block) => adminActionBlockLabels[block]).join(", ")}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-600">{item.reason || "-"}</p>
                      <p className="text-[11px] text-gray-500">
                        {formatDateTime(item.startsAt)} to {formatDateTime(item.endsAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No active controls.</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Ban</h3>
            <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Ban reason" disabled={userAccessActionDisabled || banSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg" />
            <input value={banNote} onChange={(e) => setBanNote(e.target.value)} placeholder="Note (optional)" disabled={userAccessActionDisabled || banSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <input type="datetime-local" value={banStartsAt} onChange={(e) => setBanStartsAt(e.target.value)} disabled={userAccessActionDisabled || banSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg" />
              <input type="datetime-local" value={banEndsAt} onChange={(e) => setBanEndsAt(e.target.value)} disabled={userAccessActionDisabled || banSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg" />
            </div>
            <input type="number" min={1} value={banDurationHours} onChange={(e) => setBanDurationHours(e.target.value)} placeholder="Duration hours (default 24)" disabled={userAccessActionDisabled || banSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg" />
            <button onClick={() => void onSubmitBan()} disabled={userAccessActionDisabled || banSubmitting} title={userAccessManageBlocked ? userAccessTooltip : undefined} className="w-full px-3 py-2 text-sm text-white bg-red-600 rounded-lg disabled:opacity-50">{banSubmitting ? "Submitting..." : isMainAdmin ? "Apply Ban" : "Submit Ban Request"}</button>
          </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{isMainAdmin ? "Approval Queue" : "My Requests"}</h2>
            <p className="text-xs text-gray-500">{approvalTotal} total request(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={approvalActionType} onChange={(e) => { setApprovalPage(1); setApprovalActionType(e.target.value as AdminApprovalActionType | typeof ALL_APPROVAL_ACTION); }} className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg">
              <option value={ALL_APPROVAL_ACTION}>All Actions</option><option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option><option value="USER_RESTRICTION_UPSERT">USER_RESTRICTION_UPSERT</option><option value="USER_BAN">USER_BAN</option>
            </select>
            <select value={approvalStatus} onChange={(e) => { setApprovalPage(1); setApprovalStatus(e.target.value as AdminApprovalRequestStatus | typeof ALL_APPROVAL_STATUS); }} className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg">
              <option value={ALL_APPROVAL_STATUS}>All Statuses</option><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option><option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {approvalLoading ? <div className="px-5 py-8 text-sm text-gray-500">Loading approval requests...</div> : approvalError ? <div className="px-5 py-8 text-sm text-red-600">{approvalError}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-200"><th className="px-5 py-3">Created</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">Requester</th><th className="px-5 py-3">Status</th>{isMainAdmin && <th className="px-5 py-3 text-right">Decision</th>}</tr></thead>
              <tbody>
                {approvalRows.map((request) => (
                  <tr key={request.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-600">{formatDateTime(request.createdAt)}</td>
                    <td className="px-5 py-3 text-gray-700">{formatApprovalAction(request.actionType)}</td>
                    <td className="px-5 py-3 text-gray-700">{request.targetUser?.email || request.targetUserId}</td>
                    <td className="px-5 py-3 text-gray-700">{request.requestedByUser?.email || request.requestedByUserId || "-"}</td>
                    <td className="px-5 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${approvalStatusBadge(request.status)}`}>{request.status || "-"}</span></td>
                    {isMainAdmin && (
                      <td className="px-5 py-3 text-right">
                        {request.status === "PENDING" ? (
                          <div className="inline-flex gap-2">
                            <button onClick={() => void onDecideRequest(request, "APPROVE")} disabled={decidingId === request.id || approvalReviewBlocked} title={approvalReviewBlocked ? approvalReviewTooltip : undefined} className="px-2 py-1 text-xs text-white bg-emerald-600 rounded-md disabled:opacity-50">Approve</button>
                            <button onClick={() => void onDecideRequest(request, "REJECT")} disabled={decidingId === request.id || approvalReviewBlocked} title={approvalReviewBlocked ? approvalReviewTooltip : undefined} className="px-2 py-1 text-xs text-white bg-red-600 rounded-md disabled:opacity-50">Reject</button>
                          </div>
                        ) : <span className="text-xs text-gray-400">-</span>}
                      </td>
                    )}
                  </tr>
                ))}
                {!approvalRows.length && <tr><td colSpan={isMainAdmin ? 6 : 5} className="px-5 py-8 text-center text-gray-400">No approval requests found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button onClick={() => setApprovalPage((p) => Math.max(1, p - 1))} disabled={!approvalCanGoPrev} className="px-3 py-1.5 text-xs bg-gray-100 rounded-md disabled:opacity-50">Prev</button>
          <span className="text-xs text-gray-500">Page {approvalPage} / {approvalTotalPages}</span>
          <button onClick={() => setApprovalPage((p) => Math.min(approvalTotalPages, p + 1))} disabled={!approvalCanGoNext} className="px-3 py-1.5 text-xs bg-gray-100 rounded-md disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
