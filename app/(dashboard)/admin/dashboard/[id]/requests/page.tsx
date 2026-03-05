"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  type AdminAuthCardAction,
  decideAdminApprovalRequest,
  decideAdminBranchProductApprovalRequest,
  getAdminApprovalRequests,
  getAdminBranchProductApprovalRequests,
  handleAccountAccessDeniedError,
  startAdminApprovalRequestAuthCardOtp,
  updateAdminBranchProductRequestControl,
  type AdminApprovalRequest,
  type AdminBranchProductApprovalRequest,
  verifyAdminApprovalRequestAuthCardOtp,
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

type AuthCardRequestPayload = {
  productId: string;
  authCardAction: AdminAuthCardAction;
  reason: string | null;
};

type ApprovalOtpModalState = {
  requestId: string;
  action: AdminAuthCardAction;
  productId: string;
  challengeId: string;
  maskedEmail: string;
  otp: string;
  verified: boolean;
  busy: "send" | "verify" | "approve" | "";
  error: string;
  info: string;
};

const createDecisionDraft = (): ApprovalDecisionDraft => ({
  decisionNote: "",
  enableAutoApproveForFuture: false,
});

const normalizeOtpInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const getAuthCardActionLabel = (action: AdminAuthCardAction) => {
  switch (action) {
    case "REGENERATE":
      return "Regenerate Card";
    case "REPLACE":
      return "Replace Card";
    case "REVOKE":
      return "Revoke Card";
    default:
      return action;
  }
};

const getAuthCardRequestPayload = (
  request: AdminApprovalRequest,
): AuthCardRequestPayload | null => {
  const payload =
    request.requestPayload && typeof request.requestPayload === "object" && !Array.isArray(request.requestPayload)
      ? (request.requestPayload as Record<string, unknown>)
      : null;

  const approvalScope =
    typeof payload?.approvalScope === "string" ? payload.approvalScope.trim() : "";
  const approvalFlow =
    typeof payload?.approvalFlow === "string" ? payload.approvalFlow.trim() : "";
  const productId = typeof payload?.productId === "string" ? payload.productId.trim() : "";
  const authCardAction =
    typeof payload?.authCardAction === "string" ? payload.authCardAction.trim().toUpperCase() : "";

  if (
    request.actionType !== "PRODUCT_UPDATE" ||
    approvalScope !== "PRODUCT_AUTH_CARD" ||
    approvalFlow !== "ADMIN_PRODUCT_AUTH_CARD" ||
    !productId ||
    (authCardAction !== "REGENERATE" &&
      authCardAction !== "REPLACE" &&
      authCardAction !== "REVOKE")
  ) {
    return null;
  }

  return {
    productId,
    authCardAction: authCardAction as AdminAuthCardAction,
    reason:
      typeof payload?.reason === "string" && payload.reason.trim()
        ? payload.reason.trim()
        : null,
  };
};

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
  const searchParams = useSearchParams();
  const { dashboardBasePath, isMainAdmin, userId } = useRole();
  const focusRequestId = (searchParams.get("requestId") || "").trim();
  const shortcutDecision = (() => {
    const rawDecision = (searchParams.get("decision") || "").trim().toUpperCase();
    return rawDecision === "APPROVE" || rawDecision === "REJECT" ? rawDecision : "";
  })();
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
  const [approvalOtpModal, setApprovalOtpModal] = useState<ApprovalOtpModalState | null>(null);

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

  useEffect(() => {
    if (!focusRequestId) {
      return;
    }

    const targetCard =
      document.getElementById(`approval-request-${focusRequestId}`) ||
      document.getElementById(`branch-product-request-${focusRequestId}`);
    if (!targetCard) {
      return;
    }

    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [focusRequestId, approvalRows, branchProductRows]);

  useEffect(() => {
    if (!focusRequestId || !shortcutDecision) {
      return;
    }

    const actionKey = shortcutDecision === "REJECT" ? "reject" : "approve";
    const targetButton =
      document.getElementById(`approval-request-${focusRequestId}-${actionKey}`) ||
      document.getElementById(`branch-product-request-${focusRequestId}-${actionKey}`);
    if (!targetButton) {
      return;
    }

    targetButton.focus({
      preventScroll: true,
    });
  }, [focusRequestId, shortcutDecision, approvalRows, branchProductRows]);

  const getApprovalDraft = useCallback(
    (requestId: string) => approvalDrafts[requestId] || createDecisionDraft(),
    [approvalDrafts],
  );

  const getBranchProductDraft = useCallback(
    (request: AdminBranchProductApprovalRequest) =>
      branchProductDrafts[request.id] ||
      createBranchProductDecisionDraft(request.requestedCommissionRate),
    [branchProductDrafts],
  );

  const getControlDraft = useCallback(
    (request: AdminBranchProductApprovalRequest) =>
      requestControlDrafts[request.id] || createRequestControlDraft(request),
    [requestControlDrafts],
  );

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

  const updateApprovalOtpModal = useCallback((patch: Partial<ApprovalOtpModalState>) => {
    setApprovalOtpModal((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const openApprovalOtpModal = useCallback((request: AdminApprovalRequest, payload: AuthCardRequestPayload) => {
    setApprovalMessage("");
    setApprovalOtpModal({
      requestId: request.id,
      action: payload.authCardAction,
      productId: payload.productId,
      challengeId: "",
      maskedEmail: "",
      otp: "",
      verified: false,
      busy: "",
      error: "",
      info: "",
    });
  }, []);

  const closeApprovalOtpModal = useCallback(() => {
    setApprovalOtpModal(null);
  }, []);

  const sendApprovalOtp = useCallback(async () => {
    if (!approvalOtpModal) {
      return;
    }

    updateApprovalOtpModal({
      busy: "send",
      error: "",
      info: "",
      verified: false,
      otp: "",
      challengeId: "",
      maskedEmail: "",
    });

    try {
      const accessToken = await getAccessToken();
      const response = await startAdminApprovalRequestAuthCardOtp({
        accessToken,
        requestId: approvalOtpModal.requestId,
      });

      updateApprovalOtpModal({
        busy: "",
        challengeId: response.challenge?.id || "",
        maskedEmail: response.challenge?.maskedEmail || "",
        info: response.message || "Verification code sent.",
      });
    } catch (caughtError) {
      updateApprovalOtpModal({
        busy: "",
        error:
          caughtError instanceof Error ? caughtError.message : "Failed to send verification code.",
      });
    }
  }, [approvalOtpModal, getAccessToken, updateApprovalOtpModal]);

  const verifyApprovalOtp = useCallback(async () => {
    if (!approvalOtpModal?.challengeId) {
      updateApprovalOtpModal({
        error: "Send a verification code first.",
      });
      return;
    }

    updateApprovalOtpModal({
      busy: "verify",
      error: "",
      info: "",
    });

    try {
      const accessToken = await getAccessToken();
      const response = await verifyAdminApprovalRequestAuthCardOtp({
        accessToken,
        requestId: approvalOtpModal.requestId,
        challengeId: approvalOtpModal.challengeId,
        otp: approvalOtpModal.otp,
      });

      updateApprovalOtpModal({
        busy: "",
        verified: true,
        info: response.message || "Verification code confirmed.",
      });
    } catch (caughtError) {
      updateApprovalOtpModal({
        busy: "",
        verified: false,
        error:
          caughtError instanceof Error ? caughtError.message : "Failed to verify code.",
      });
    }
  }, [approvalOtpModal, getAccessToken, updateApprovalOtpModal]);

  const confirmApprovalWithOtp = useCallback(async () => {
    if (!approvalOtpModal?.verified || !approvalOtpModal.challengeId) {
      updateApprovalOtpModal({
        error: "Verify the email code before approving this request.",
      });
      return;
    }

    const request = approvalRows.find((row) => row.id === approvalOtpModal.requestId);
    if (!request) {
      updateApprovalOtpModal({
        error: "Approval request could not be found.",
      });
      return;
    }

    const draft = getApprovalDraft(request.id);
    setApprovalBusyId(request.id);
    updateApprovalOtpModal({
      busy: "approve",
      error: "",
      info: "",
    });

    try {
      const accessToken = await getAccessToken();
      const response = await decideAdminApprovalRequest({
        accessToken,
        requestId: request.id,
        decision: "APPROVE",
        decisionNote: draft.decisionNote.trim() || undefined,
        enableAutoApproveForFuture: draft.enableAutoApproveForFuture,
        otpChallengeId: approvalOtpModal.challengeId,
      });

      setApprovalMessage(
        response.message || "Authenticity card request approved successfully.",
      );
      setApprovalOtpModal(null);
      await loadRequests();
    } catch (caughtError) {
      updateApprovalOtpModal({
        busy: "",
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to approve authenticity card request.",
      });
    } finally {
      setApprovalBusyId("");
    }
  }, [approvalOtpModal, approvalRows, getAccessToken, getApprovalDraft, loadRequests, updateApprovalOtpModal]);

  const decideApproval = useCallback(
    async (request: AdminApprovalRequest, decision: "APPROVE" | "REJECT") => {
      const authCardPayload = getAuthCardRequestPayload(request);
      if (decision === "APPROVE" && authCardPayload && isMainAdmin) {
        openApprovalOtpModal(request, authCardPayload);
        return;
      }

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
    [getAccessToken, getApprovalDraft, isMainAdmin, loadRequests, openApprovalOtpModal],
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
    [getAccessToken, getBranchProductDraft, loadRequests],
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
    [getAccessToken, getControlDraft, loadRequests],
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
              const isFocused = focusRequestId === request.id;

              return (
                <div
                  id={`branch-product-request-${request.id}`}
                  key={request.id}
                  className={`grid gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_360px] ${
                    isFocused ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                  }`}
                >
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
                            id={`branch-product-request-${request.id}-approve`}
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
                            id={`branch-product-request-${request.id}-reject`}
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
              const authCardPayload = getAuthCardRequestPayload(request);
              const isFocused = focusRequestId === request.id;

              return (
                <div
                  id={`approval-request-${request.id}`}
                  key={request.id}
                  className={`grid gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_320px] ${
                    isFocused ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                  }`}
                >
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
                    {authCardPayload ? (
                      <>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Card Action: {getAuthCardActionLabel(authCardPayload.authCardAction)}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Product ID: {authCardPayload.productId}
                        </p>
                      </>
                    ) : null}
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
                          id={`approval-request-${request.id}-approve`}
                          type="button"
                          onClick={() => {
                            void decideApproval(request, "APPROVE");
                          }}
                          disabled={approvalBusyId === request.id}
                          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          {approvalBusyId === request.id
                            ? "Saving..."
                            : authCardPayload
                              ? "Approve With OTP"
                              : "Approve"}
                        </button>
                        <button
                          id={`approval-request-${request.id}-reject`}
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

      {approvalOtpModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700/60 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {getAuthCardActionLabel(approvalOtpModal.action)}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Main admin OTP confirmation is required before approving this authenticity card action.
                </p>
              </div>
              <button
                type="button"
                onClick={closeApprovalOtpModal}
                disabled={approvalOtpModal.busy === "approve"}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-300">
                <p>Product ID: {approvalOtpModal.productId}</p>
                <p className="mt-1">Action: {getAuthCardActionLabel(approvalOtpModal.action)}</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Email Verification
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {approvalOtpModal.maskedEmail
                        ? `Code sent to ${approvalOtpModal.maskedEmail}`
                        : "Send a 6 digit OTP to the main admin email address."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void sendApprovalOtp();
                    }}
                    disabled={approvalOtpModal.busy === "send" || approvalOtpModal.busy === "approve"}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  >
                    {approvalOtpModal.busy === "send"
                      ? "Sending..."
                      : approvalOtpModal.challengeId
                        ? "Resend OTP"
                        : "Send OTP"}
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={approvalOtpModal.otp}
                    onChange={(event) =>
                      updateApprovalOtpModal({
                        otp: normalizeOtpInput(event.target.value),
                        verified: false,
                      })
                    }
                    placeholder="6 digit code"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void verifyApprovalOtp();
                    }}
                    disabled={
                      approvalOtpModal.busy === "verify" ||
                      approvalOtpModal.busy === "approve" ||
                      approvalOtpModal.otp.length !== 6 ||
                      !approvalOtpModal.challengeId
                    }
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {approvalOtpModal.busy === "verify" ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
              </div>

              {approvalOtpModal.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
                  {approvalOtpModal.error}
                </div>
              ) : null}

              {approvalOtpModal.info ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                  {approvalOtpModal.info}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeApprovalOtpModal}
                  disabled={approvalOtpModal.busy === "approve"}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void confirmApprovalWithOtp();
                  }}
                  disabled={!approvalOtpModal.verified || approvalOtpModal.busy === "approve"}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approvalOtpModal.busy === "approve" ? "Approving..." : "Approve Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
