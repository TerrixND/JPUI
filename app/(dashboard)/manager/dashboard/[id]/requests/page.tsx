"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  decideManagerBranchApprovalRequest,
  getManagerAnalyticsBranches,
  getManagerBranchApprovalRequests,
  type ManagerBranchApprovalRequestRecord,
  type ManagerBranchApprovalViewerScope,
} from "@/lib/managerApi";
import { formatManagerDateTime, managerStatusBadge } from "@/lib/managerDashboardUi";

type DecisionDraft = {
  decisionNote: string;
  enableAutoApproveForFuture: boolean;
};

const STATUS_OPTIONS = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

const createDecisionDraft = (): DecisionDraft => ({
  decisionNote: "",
  enableAutoApproveForFuture: false,
});

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const readPayloadString = (
  request: ManagerBranchApprovalRequestRecord,
  key: string,
) => {
  const payload = asRecord(request.requestPayload);
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const readPayloadBoolean = (
  request: ManagerBranchApprovalRequestRecord,
  key: string,
) => {
  const payload = asRecord(request.requestPayload);
  return payload?.[key] === true;
};

const toActionLabel = (value: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return "Request";
  }

  if (normalized === "RESTRICT") return "Restrict";
  if (normalized === "BAN") return "Ban";
  if (normalized === "ACTIVATE") return "Reactivate";
  if (normalized === "TERMINATE") return "Terminate";

  return normalized
    .toLowerCase()
    .split("_")
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
};

const toViewerScopeMessage = ({
  viewerScope,
  canDecide,
}: {
  viewerScope: ManagerBranchApprovalViewerScope | null;
  canDecide: boolean;
}) => {
  if (canDecide || viewerScope === "BRANCH_ADMIN") {
    return "Review and decide branch manager moderation requests for the selected branch.";
  }

  if (viewerScope === "MANAGED_BRANCHES") {
    return "You can monitor all request activity in the selected branch. Approval decisions remain with the branch admin.";
  }

  return "You can monitor requests submitted by your account for the selected branch.";
};

export default function ManagerRequestsPage() {
  const searchParams = useSearchParams();
  const { dashboardBasePath } = useRole();
  const focusRequestId = (searchParams.get("requestId") || "").trim();
  const shortcutDecision = (() => {
    const rawDecision = (searchParams.get("decision") || "").trim().toUpperCase();
    return rawDecision === "APPROVE" || rawDecision === "REJECT" ? rawDecision : "";
  })();

  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [branchId, setBranchId] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("PENDING");

  const [rows, setRows] = useState<ManagerBranchApprovalRequestRecord[]>([]);
  const [viewerScope, setViewerScope] = useState<ManagerBranchApprovalViewerScope | null>(null);
  const [canDecide, setCanDecide] = useState(false);
  const [canViewAllManagedBranchRequests, setCanViewAllManagedBranchRequests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({});

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

  const loadBranchOptions = useCallback(async () => {
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
    if (!options.length) {
      setRows([]);
      setViewerScope(null);
      setCanDecide(false);
      setCanViewAllManagedBranchRequests(false);
      setLoading(false);
    }
  }, [getAccessToken]);

  const loadRequests = useCallback(
    async (nextBranchId = branchId) => {
      if (!nextBranchId) {
        setRows([]);
        setViewerScope(null);
        setCanDecide(false);
        setCanViewAllManagedBranchRequests(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const response = await getManagerBranchApprovalRequests({
          accessToken,
          branchId: nextBranchId,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          limit: 100,
        });

        setRows(response.records);
        setViewerScope(response.viewerScope);
        setCanDecide(response.canDecide);
        setCanViewAllManagedBranchRequests(response.canViewAllManagedBranchRequests);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        setRows([]);
        setViewerScope(null);
        setCanDecide(false);
        setCanViewAllManagedBranchRequests(false);
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [branchId, getAccessToken, statusFilter],
  );

  useEffect(() => {
    void (async () => {
      try {
        await loadBranchOptions();
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        setBranchOptions([]);
        setBranchId("");
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    })();
  }, [loadBranchOptions]);

  useEffect(() => {
    if (!branchId) {
      return;
    }

    void loadRequests(branchId);
  }, [branchId, loadRequests]);

  useEffect(() => {
    if (!focusRequestId) {
      return;
    }

    const targetCard = document.getElementById(`manager-approval-request-${focusRequestId}`);
    if (!targetCard) {
      return;
    }

    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [focusRequestId, rows]);

  useEffect(() => {
    if (!focusRequestId || !shortcutDecision) {
      return;
    }

    const actionKey = shortcutDecision === "REJECT" ? "reject" : "approve";
    const targetButton = document.getElementById(
      `manager-approval-request-${focusRequestId}-${actionKey}`,
    );
    if (!targetButton) {
      return;
    }

    targetButton.focus({
      preventScroll: true,
    });
  }, [focusRequestId, shortcutDecision, rows]);

  const branchLabelMap = useMemo(
    () =>
      new Map(
        branchOptions.map((option) => [option.id, option.label] as const),
      ),
    [branchOptions],
  );

  const selectedBranchLabel =
    branchLabelMap.get(branchId) || branchId || "selected branch";

  const summary = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((row) => row.status === "PENDING").length;
    const approved = rows.filter((row) => row.status === "APPROVED").length;
    const rejected = rows.filter((row) => row.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [rows]);

  const getDecisionDraft = useCallback(
    (requestId: string) => drafts[requestId] || createDecisionDraft(),
    [drafts],
  );

  const updateDecisionDraft = (
    requestId: string,
    patch: Partial<DecisionDraft>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] || createDecisionDraft()),
        ...patch,
      },
    }));
  };

  const decideRequest = useCallback(
    async (
      request: ManagerBranchApprovalRequestRecord,
      decision: "APPROVE" | "REJECT",
    ) => {
      const draft = getDecisionDraft(request.id);
      setBusyId(request.id);
      setNotice("");
      setError("");

      try {
        const accessToken = await getAccessToken();
        const response = await decideManagerBranchApprovalRequest({
          accessToken,
          requestId: request.id,
          decision,
          decisionNote: draft.decisionNote.trim() || undefined,
          doNotAskAgainForAction:
            decision === "APPROVE" ? draft.enableAutoApproveForFuture : undefined,
        });

        setNotice(
          response.message || `Request ${decision.toLowerCase()}d successfully.`,
        );
        await loadRequests();
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        setError(getErrorMessage(caughtError));
      } finally {
        setBusyId("");
      }
    },
    [getAccessToken, getDecisionDraft, loadRequests],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        description={toViewerScopeMessage({ viewerScope, canDecide })}
        action={
          <button
            type="button"
            onClick={() => void loadRequests()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        }
      />

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900 md:grid-cols-[minmax(0,1fr)_220px_180px]">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Branch
          </span>
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            {branchOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number])
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "ALL" ? "All statuses" : status}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          <p className="font-semibold">Selected scope</p>
          <p className="mt-1 text-xs leading-5">
            {selectedBranchLabel}
          </p>
          <p className="mt-2 text-xs leading-5 text-emerald-600/90 dark:text-emerald-300/90">
            {canDecide
              ? "You can approve and reject pending requests in this branch."
              : canViewAllManagedBranchRequests
                ? "You can review all request activity in this branch."
                : "You can review requests submitted by your account in this branch."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Visible Requests", value: summary.total },
          { label: "Pending", value: summary.pending },
          { label: "Approved", value: summary.approved },
          { label: "Rejected", value: summary.rejected },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900"
            />
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            No requests found for the current branch and status filter.
          </div>
        ) : (
          rows.map((request) => {
            const requestBranchId = readPayloadString(request, "branchId");
            const targetStatus = readPayloadString(request, "status");
            const statusAction = readPayloadString(request, "statusAction");
            const targetRole = readPayloadString(request, "targetRole");
            const autoApproveFuture = readPayloadBoolean(
              request,
              "autoApproveFuture",
            );
            const userHref = `${dashboardBasePath}/users/${request.targetUserId}${
              requestBranchId ? `?branchId=${encodeURIComponent(requestBranchId)}` : ""
            }`;
            const draft = getDecisionDraft(request.id);
            const isPending = request.status === "PENDING";
            const isBusy = busyId === request.id;
            const isFocused = focusRequestId === request.id;

            return (
              <div
                id={`manager-approval-request-${request.id}`}
                key={request.id}
                className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-900 ${
                  isFocused ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${managerStatusBadge(
                          request.status,
                        )}`}
                      >
                        {request.status || "UNKNOWN"}
                      </span>
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {toActionLabel(statusAction)}
                      </span>
                      {autoApproveFuture ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Auto-approve future enabled
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Request
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {toActionLabel(statusAction)} {targetRole?.toLowerCase() || "user"} account
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {request.requestReason || "No reason provided."}
                      </p>
                    </div>

                    <div className="grid gap-3 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Target User
                        </p>
                        <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                          {request.targetUser?.email || request.targetUserId}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {targetStatus ? `Requested status: ${targetStatus}` : request.targetUser?.status || "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Requested By
                        </p>
                        <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                          {request.requestedByUser?.email || request.requestedByUserId || "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {branchLabelMap.get(requestBranchId || "") || requestBranchId || selectedBranchLabel}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Submitted
                        </p>
                        <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                          {formatManagerDateTime(request.createdAt)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Request ID: {request.id}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Reviewed By
                        </p>
                        <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                          {request.reviewedByUser?.email || "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatManagerDateTime(request.decidedAt)}
                        </p>
                      </div>
                    </div>

                    {request.decisionNote ? (
                      <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-gray-800/70 dark:text-gray-300">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Decision Note
                        </p>
                        <p className="mt-1">{request.decisionNote}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 lg:w-[320px]">
                    <Link
                      href={userHref}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Open User Detail
                    </Link>

                    {canDecide && isPending ? (
                      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-700/40 dark:bg-amber-900/10">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Branch Admin Decision
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Approve or reject this request for the selected branch.
                          </p>
                        </div>

                        <textarea
                          rows={4}
                          value={draft.decisionNote}
                          onChange={(event) =>
                            updateDecisionDraft(request.id, {
                              decisionNote: event.target.value,
                            })
                          }
                          placeholder="Decision note (optional)"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />

                        <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={draft.enableAutoApproveForFuture}
                            onChange={(event) =>
                              updateDecisionDraft(request.id, {
                                enableAutoApproveForFuture: event.target.checked,
                              })
                            }
                            className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Auto-approve this same action in future for this manager and branch.</span>
                        </label>

                        <div className="flex gap-2">
                          <button
                            id={`manager-approval-request-${request.id}-approve`}
                            type="button"
                            disabled={isBusy}
                            onClick={() => void decideRequest(request, "APPROVE")}
                            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? "Saving..." : "Approve"}
                          </button>
                          <button
                            id={`manager-approval-request-${request.id}-reject`}
                            type="button"
                            disabled={isBusy}
                            onClick={() => void decideRequest(request, "REJECT")}
                            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? "Saving..." : "Reject"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700/60 dark:bg-gray-800/60 dark:text-gray-300">
                        {isPending
                          ? canViewAllManagedBranchRequests
                            ? "Pending review by the branch admin."
                            : "Pending review. You can monitor the status here."
                          : "Decision recorded. No further action is available on this request."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
