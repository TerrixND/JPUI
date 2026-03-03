"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  decideAdminApprovalRequest,
  decideAdminBranchProductApprovalRequest,
  getAdminApprovalRequests,
  getAdminBranchProductApprovalRequests,
  handleAccountAccessDeniedError,
  updateAdminBranchProductRequestControl,
  type AdminApprovalRequest,
  type AdminBranchProductApprovalRequest,
} from "@/lib/apiClient";
import {
  approvalStatusBadge,
  formatDateTime,
} from "@/lib/adminUiHelpers";

type ApprovalDecisionDraft = {
  decisionNote: string;
  enableAutoApproveForFuture: boolean;
};

type BranchProductDecisionDraft = {
  decisionNote: string;
  commissionRate: string;
};

type RequestControlDraft = {
  cooldownMinutes: string;
  retryLimit: string;
  note: string;
};

const createDecisionDraft = (): ApprovalDecisionDraft => ({
  decisionNote: "",
  enableAutoApproveForFuture: false,
});

const createBranchProductDecisionDraft = (
  commissionRate: number | null = null,
): BranchProductDecisionDraft => ({
  decisionNote: "",
  commissionRate:
    typeof commissionRate === "number" && Number.isFinite(commissionRate)
      ? String(commissionRate)
      : "",
});

const createRequestControlDraft = (
  request: AdminBranchProductApprovalRequest,
): RequestControlDraft => {
  const firstControl = request.requestedProducts[0]?.requestControl;
  return {
    cooldownMinutes: String(firstControl?.cooldownMinutes ?? 60),
    retryLimit: String(firstControl?.retryLimit ?? 5),
    note: firstControl?.note || "",
  };
};

export default function AdminRequestsPage() {
  const { dashboardBasePath, isMainAdmin, userId } = useRole();
  const [branchProductRows, setBranchProductRows] = useState<AdminBranchProductApprovalRequest[]>([]);
  const [branchProductLoading, setBranchProductLoading] = useState(true);
  const [branchProductError, setBranchProductError] = useState("");
  const [branchProductBusyId, setBranchProductBusyId] = useState("");
  const [branchProductMessage, setBranchProductMessage] = useState("");
  const [branchProductDrafts, setBranchProductDrafts] = useState<
    Record<string, BranchProductDecisionDraft>
  >({});
  const [requestControlDrafts, setRequestControlDrafts] = useState<
    Record<string, RequestControlDraft>
  >({});
  const [requestControlBusyKey, setRequestControlBusyKey] = useState("");

  const [approvalRows, setApprovalRows] = useState<AdminApprovalRequest[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [approvalError, setApprovalError] = useState("");
  const [approvalBusyId, setApprovalBusyId] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, ApprovalDecisionDraft>>({});

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

  const loadRequests = useCallback(async () => {
    setBranchProductLoading(true);
    setApprovalLoading(true);
    setBranchProductError("");
    setApprovalError("");

    try {
      const accessToken = await getAccessToken();
      const [branchProducts, approvals] = await Promise.all([
        isMainAdmin
          ? getAdminBranchProductApprovalRequests({
              accessToken,
              limit: 20,
            })
          : Promise.resolve(null),
        getAdminApprovalRequests({
          accessToken,
          limit: 20,
          requestedByUserId: isMainAdmin ? undefined : userId,
        }),
      ]);

      setBranchProductRows(branchProducts?.items || []);
      setApprovalRows(approvals.items);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to load requests.";
      setBranchProductRows([]);
      setApprovalRows([]);
      setBranchProductError(message);
      setApprovalError(message);
    } finally {
      setBranchProductLoading(false);
      setApprovalLoading(false);
    }
  }, [getAccessToken, isMainAdmin, userId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const getApprovalDraft = (requestId: string) =>
    approvalDrafts[requestId] || createDecisionDraft();

  const getBranchProductDraft = (request: AdminBranchProductApprovalRequest) =>
    branchProductDrafts[request.id] ||
    createBranchProductDecisionDraft(request.requestedCommissionRate);

  const getControlDraft = (request: AdminBranchProductApprovalRequest) =>
    requestControlDrafts[request.id] || createRequestControlDraft(request);

  const updateApprovalDraft = (requestId: string, patch: Partial<ApprovalDecisionDraft>) => {
    setApprovalDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] || createDecisionDraft()),
        ...patch,
      },
    }));
  };

  const updateBranchProductDraft = (
    request: AdminBranchProductApprovalRequest,
    patch: Partial<BranchProductDecisionDraft>,
  ) => {
    setBranchProductDrafts((current) => ({
      ...current,
      [request.id]: {
        ...(current[request.id] || createBranchProductDecisionDraft(request.requestedCommissionRate)),
        ...patch,
      },
    }));
  };

  const updateControlDraft = (
    request: AdminBranchProductApprovalRequest,
    patch: Partial<RequestControlDraft>,
  ) => {
    setRequestControlDrafts((current) => ({
      ...current,
      [request.id]: {
        ...(current[request.id] || createRequestControlDraft(request)),
        ...patch,
      },
    }));
  };

  const decideApproval = useCallback(
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

        setApprovalMessage(
          response.message || `Request ${decision.toLowerCase()}d successfully.`,
        );
        await loadRequests();
      } catch (caughtError) {
        setApprovalMessage(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to decide request.",
        );
      } finally {
        setApprovalBusyId("");
      }
    },
    [getAccessToken, loadRequests, approvalDrafts],
  );

  const decideBranchProduct = useCallback(
    async (
      request: AdminBranchProductApprovalRequest,
      decision: "APPROVE" | "REJECT",
    ) => {
      const draft = getBranchProductDraft(request);
      setBranchProductBusyId(request.id);
      setBranchProductMessage("");

      try {
        const accessToken = await getAccessToken();
        const normalizedRate = draft.commissionRate.trim();
        const parsedRate = normalizedRate ? Number(normalizedRate) : null;
        if (
          decision === "APPROVE" &&
          !normalizedRate &&
          request.requestedCommissionRate === null
        ) {
          throw new Error("Commission rate is required to approve this request.");
        }
        if (
          normalizedRate &&
          (!Number.isFinite(parsedRate) || parsedRate === null || parsedRate < 0 || parsedRate > 100)
        ) {
          throw new Error("Commission rate must be between 0 and 100.");
        }

        const response = await decideAdminBranchProductApprovalRequest({
          accessToken,
          requestId: request.id,
          decision,
          decisionNote: draft.decisionNote.trim() || undefined,
          commissionRate:
            typeof parsedRate === "number" && Number.isFinite(parsedRate) ? parsedRate : undefined,
        });

        setBranchProductMessage(
          response.message || `Branch product request ${decision.toLowerCase()}d successfully.`,
        );
        await loadRequests();
      } catch (caughtError) {
        setBranchProductMessage(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to decide branch product request.",
        );
      } finally {
        setBranchProductBusyId("");
      }
    },
    [branchProductDrafts, getAccessToken, loadRequests],
  );

  const saveRequestControl = useCallback(
    async (request: AdminBranchProductApprovalRequest, resolveCooldown = false) => {
      const branchId = request.branch?.id;
      const draft = getControlDraft(request);
      const parsedCooldown = Number(draft.cooldownMinutes);
      const parsedRetryLimit = Number(draft.retryLimit);

      if (!branchId || request.requestedProducts.length === 0) {
        setBranchProductMessage("Branch product request is missing branch or product data.");
        return;
      }
      if (!Number.isInteger(parsedCooldown) || parsedCooldown < 0) {
        setBranchProductMessage("Cooldown minutes must be a non-negative integer.");
        return;
      }
      if (!Number.isInteger(parsedRetryLimit) || parsedRetryLimit <= 0) {
        setBranchProductMessage("Retry limit must be a positive integer.");
        return;
      }

      setRequestControlBusyKey(request.id);
      setBranchProductMessage("");

      try {
        const accessToken = await getAccessToken();
        await Promise.all(
          request.requestedProducts.map((product) =>
            updateAdminBranchProductRequestControl({
              accessToken,
              branchId,
              productId: product.id,
              cooldownMinutes: parsedCooldown,
              retryLimit: parsedRetryLimit,
              resolveCooldown,
              note: draft.note.trim() || null,
            }),
          ),
        );

        setBranchProductMessage(
          resolveCooldown
            ? "Cooldown controls updated and current cooldown resolved."
            : "Cooldown controls updated.",
        );
        await loadRequests();
      } catch (caughtError) {
        setBranchProductMessage(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to update request controls.",
        );
      } finally {
        setRequestControlBusyKey("");
      }
    },
    [getAccessToken, loadRequests, requestControlDrafts],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        description="Separate review queue for product requests and other approval requests."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void loadRequests();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Refresh Requests
            </button>
            <Link
              href={`${dashboardBasePath}/users`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Users
            </Link>
          </div>
        }
      />

      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Product Requests
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manager-submitted branch product selections with commission approval and cooldown policy controls.
          </p>
        </div>

        {!isMainAdmin ? (
          <div className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">
            Product request review is available to Main Admin only.
          </div>
        ) : branchProductLoading ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
              />
            ))}
          </div>
        ) : branchProductError ? (
          <div className="px-5 py-6 text-sm text-red-600 dark:text-red-300">{branchProductError}</div>
        ) : branchProductRows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">
            No branch product requests found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {branchProductRows.map((request) => {
              const decisionDraft = getBranchProductDraft(request);
              const controlDraft = getControlDraft(request);
              const isPending = request.status === "PENDING";

              return (
                <div key={request.id} className="grid gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {request.branch?.name || request.branch?.code || request.id}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${approvalStatusBadge(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Requester: {request.requestedByUser?.email || request.requestedByUserId || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Requested commission: {request.requestedCommissionRate ?? "-"}%
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Created {formatDateTime(request.createdAt)}
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {request.requestedProducts.map((product) => (
                        <div
                          key={product.id}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40"
                        >
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {product.name || product.sku || product.id}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Sale range: {product.saleRangeMin ?? "-"} to {product.saleRangeMax ?? "-"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Cooldown: {product.requestControl?.cooldownMinutes ?? 60} min
                            {" · "}
                            Retry limit: {product.requestControl?.retryLimit ?? 5}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Resolved at: {formatDateTime(product.requestControl?.cooldownResolvedAt ?? null)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Request Policy
                      </h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input
                          type="number"
                          min="0"
                          value={controlDraft.cooldownMinutes}
                          onChange={(event) =>
                            updateControlDraft(request, {
                              cooldownMinutes: event.target.value,
                            })
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                          placeholder="Cooldown minutes"
                        />
                        <input
                          type="number"
                          min="1"
                          value={controlDraft.retryLimit}
                          onChange={(event) =>
                            updateControlDraft(request, {
                              retryLimit: event.target.value,
                            })
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                          placeholder="Retry limit"
                        />
                      </div>
                      <textarea
                        value={controlDraft.note}
                        onChange={(event) =>
                          updateControlDraft(request, {
                            note: event.target.value,
                          })
                        }
                        rows={2}
                        className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        placeholder="Optional policy note"
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void saveRequestControl(request, false);
                          }}
                          disabled={requestControlBusyKey === request.id}
                          className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                        >
                          {requestControlBusyKey === request.id ? "Saving..." : "Save Policy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void saveRequestControl(request, true);
                          }}
                          disabled={requestControlBusyKey === request.id}
                          className="flex-1 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                        >
                          {requestControlBusyKey === request.id ? "Saving..." : "Resolve Cooldown"}
                        </button>
                      </div>
                    </div>

                    {isPending ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Decision
                        </h3>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={decisionDraft.commissionRate}
                          onChange={(event) =>
                            updateBranchProductDraft(request, {
                              commissionRate: event.target.value,
                            })
                          }
                          className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                          placeholder="Commission rate"
                        />
                        <textarea
                          value={decisionDraft.decisionNote}
                          onChange={(event) =>
                            updateBranchProductDraft(request, {
                              decisionNote: event.target.value,
                            })
                          }
                          rows={3}
                          className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                          placeholder="Decision note"
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void decideBranchProduct(request, "APPROVE");
                            }}
                            disabled={branchProductBusyId === request.id}
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                          >
                            {branchProductBusyId === request.id ? "Saving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void decideBranchProduct(request, "REJECT");
                            }}
                            disabled={branchProductBusyId === request.id}
                            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                          >
                            {branchProductBusyId === request.id ? "Saving..." : "Reject"}
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

        {branchProductMessage ? (
          <div className="border-t border-gray-200 px-5 py-4 text-sm text-emerald-700 dark:border-gray-700/60 dark:text-emerald-300">
            {branchProductMessage}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Other Requests
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Approval queue for non-product request flows.
          </p>
        </div>

        {approvalLoading ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
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
              const isPending = request.status === "PENDING" && isMainAdmin;

              return (
                <div key={request.id} className="grid gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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

                  {isPending ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                      <textarea
                        value={draft.decisionNote}
                        onChange={(event) =>
                          updateApprovalDraft(request.id, {
                            decisionNote: event.target.value,
                          })
                        }
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        placeholder="Decision note"
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
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void decideApproval(request, "APPROVE");
                          }}
                          disabled={approvalBusyId === request.id}
                          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          {approvalBusyId === request.id ? "Saving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void decideApproval(request, "REJECT");
                          }}
                          disabled={approvalBusyId === request.id}
                          className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                        >
                          {approvalBusyId === request.id ? "Saving..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  ) : null}
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
      </section>
    </div>
  );
}
