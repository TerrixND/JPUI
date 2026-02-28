"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  approveManagerAppointment,
  createManagerAppointmentPossession,
  getManagerDashboardSalespersons,
  getManagerPendingAppointments,
  getManagerProducts,
  type ManagerPendingAppointment,
  type ManagerProductSummary,
  type ManagerSalespersonListItem,
} from "@/lib/managerApi";

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

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

const statusStyle = (status: string | null) => {
  switch (status) {
    case "REQUESTED":
    case "PENDING":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
    case "CONFIRMED":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    case "COMPLETED":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
    case "CANCELLED":
      return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

type PossessionDraft = {
  productId: string;
  salespersonUserId: string;
  dueBackAt: string;
  note: string;
};

export default function ManagerAppointments() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [appointments, setAppointments] = useState<ManagerPendingAppointment[]>([]);
  const [salespersons, setSalespersons] = useState<ManagerSalespersonListItem[]>([]);
  const [productsByBranch, setProductsByBranch] = useState<
    Record<string, ManagerProductSummary[]>
  >({});
  const [expandedAppointmentId, setExpandedAppointmentId] = useState("");
  const [draftByAppointmentId, setDraftByAppointmentId] = useState<
    Record<string, PossessionDraft>
  >({});
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState("");
  const [submittingPossessionId, setSubmittingPossessionId] = useState("");

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

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const [appointmentRows, salespersonRows] = await Promise.all([
        getManagerPendingAppointments({
          accessToken,
          branchId: branchFilter || undefined,
        }),
        getManagerDashboardSalespersons({
          accessToken,
          branchId: branchFilter || undefined,
          status: ["ACTIVE", "RESTRICTED"],
        }),
      ]);

      setAppointments(appointmentRows);
      setSalespersons(salespersonRows.salespersons);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setAppointments([]);
      setSalespersons([]);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [branchFilter, getAccessToken]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const branchOptions = useMemo(() => {
    const dedupe = new Map<string, string>();
    for (const row of appointments) {
      if (!row.branch?.id) continue;
      const label =
        [row.branch.code, row.branch.name].filter(Boolean).join(" · ") || row.branch.id;
      dedupe.set(row.branch.id, label);
    }
    return Array.from(dedupe.entries()).map(([id, label]) => ({ id, label }));
  }, [appointments]);

  const salespersonsByBranch = useMemo(() => {
    const bucket: Record<string, ManagerSalespersonListItem[]> = {};
    for (const row of salespersons) {
      if (!row.branchId) continue;
      if (!bucket[row.branchId]) {
        bucket[row.branchId] = [];
      }
      bucket[row.branchId].push(row);
    }
    return bucket;
  }, [salespersons]);

  const ensureProductsForBranch = useCallback(
    async (branchId: string) => {
      if (productsByBranch[branchId]) {
        return;
      }

      const accessToken = await getAccessToken();
      const result = await getManagerProducts({
        accessToken,
        branchId,
      });

      setProductsByBranch((current) => ({
        ...current,
        [branchId]: result.products,
      }));
    },
    [getAccessToken, productsByBranch],
  );

  const onApprove = async (
    appointmentId: string,
    nextStatus: "CONFIRMED" | "CANCELLED",
  ) => {
    setUpdatingAppointmentId(appointmentId);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      await approveManagerAppointment({
        accessToken,
        appointmentId,
        status: nextStatus,
      });

      setNotice(
        nextStatus === "CONFIRMED"
          ? "Appointment confirmed successfully."
          : "Appointment cancelled successfully.",
      );
      await loadAppointments();
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setUpdatingAppointmentId("");
    }
  };

  const onOpenPossession = async (appointment: ManagerPendingAppointment) => {
    setNotice("");
    setError("");
    setExpandedAppointmentId((current) =>
      current === appointment.id ? "" : appointment.id,
    );

    if (appointment.branchId) {
      try {
        await ensureProductsForBranch(appointment.branchId);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setError(getErrorMessage(caughtError));
      }
    }
  };

  const onSubmitPossession = async (appointment: ManagerPendingAppointment) => {
    const draft = draftByAppointmentId[appointment.id];
    if (!draft?.productId || !draft?.salespersonUserId) {
      setError("Select both product and salesperson for possession allocation.");
      return;
    }

    setSubmittingPossessionId(appointment.id);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      await createManagerAppointmentPossession({
        accessToken,
        appointmentId: appointment.id,
        productId: draft.productId,
        salespersonUserId: draft.salespersonUserId,
        dueBackAt: draft.dueBackAt
          ? new Date(draft.dueBackAt).toISOString()
          : undefined,
        note: draft.note || undefined,
      });

      setNotice("Possession allocated successfully.");
      setExpandedAppointmentId("");
      setDraftByAppointmentId((current) => {
        const next = { ...current };
        delete next[appointment.id];
        return next;
      });
      await loadAppointments();
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmittingPossessionId("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Approve or cancel pending appointments, then allocate product possessions."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              <option value="">All branches</option>
              {branchOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadAppointments()}
              className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      {notice && (
        <div className="px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900"
            />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 text-sm text-gray-500 dark:text-gray-400">
          No pending appointments found for the selected branch scope.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.map((appointment) => {
            const salespersonOptions = appointment.branchId
              ? salespersonsByBranch[appointment.branchId] || []
              : [];
            const productOptions = appointment.branchId
              ? productsByBranch[appointment.branchId] || []
              : [];
            const draft = draftByAppointmentId[appointment.id] || {
              productId: "",
              salespersonUserId: "",
              dueBackAt: "",
              note: "",
            };
            const isExpanded = expandedAppointmentId === appointment.id;

            return (
              <div
                key={appointment.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                    {appointment.id}
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(
                      appointment.status,
                    )}`}
                  >
                    {appointment.status || "UNKNOWN"}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {appointment.customerName || "Walk-in customer"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {appointment.branch?.name || appointment.branchId || "Unknown branch"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDateTime(appointment.appointmentDate)}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Appointment Items
                  </p>
                  {appointment.items.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">No items listed.</p>
                  ) : (
                    appointment.items.slice(0, 3).map((item) => (
                      <p key={item.id} className="text-xs text-gray-600 dark:text-gray-300">
                        {(item.product?.sku && `${item.product.sku} · `) || ""}
                        {item.product?.name || item.productId || item.id}
                      </p>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onApprove(appointment.id, "CONFIRMED")}
                    disabled={updatingAppointmentId === appointment.id}
                    className="flex-1 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {updatingAppointmentId === appointment.id ? "Updating..." : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onApprove(appointment.id, "CANCELLED")}
                    disabled={updatingAppointmentId === appointment.id}
                    className="flex-1 py-2 border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void onOpenPossession(appointment)}
                  className="w-full py-2 border border-emerald-200 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  {isExpanded ? "Hide Possession Form" : "Allocate Possession"}
                </button>

                {isExpanded && (
                  <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={draft.productId}
                        onChange={(event) =>
                          setDraftByAppointmentId((current) => ({
                            ...current,
                            [appointment.id]: {
                              ...draft,
                              productId: event.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                      >
                        <option value="">Select product</option>
                        {productOptions.map((product) => (
                          <option key={product.id} value={product.id}>
                            {[product.sku, product.name].filter(Boolean).join(" · ") || product.id}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draft.salespersonUserId}
                        onChange={(event) =>
                          setDraftByAppointmentId((current) => ({
                            ...current,
                            [appointment.id]: {
                              ...draft,
                              salespersonUserId: event.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                      >
                        <option value="">Select salesperson</option>
                        {salespersonOptions.map((salesperson) => (
                          <option key={salesperson.userId} value={salesperson.userId}>
                            {salesperson.displayName ||
                              salesperson.email ||
                              salesperson.userId}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      type="datetime-local"
                      value={draft.dueBackAt}
                      onChange={(event) =>
                        setDraftByAppointmentId((current) => ({
                          ...current,
                          [appointment.id]: {
                            ...draft,
                            dueBackAt: event.target.value,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                    />

                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={draft.note}
                      onChange={(event) =>
                        setDraftByAppointmentId((current) => ({
                          ...current,
                          [appointment.id]: {
                            ...draft,
                            note: event.target.value,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                    />

                    <button
                      type="button"
                      onClick={() => void onSubmitPossession(appointment)}
                      disabled={submittingPossessionId === appointment.id}
                      className="w-full py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {submittingPossessionId === appointment.id
                        ? "Submitting..."
                        : "Create Possession"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
