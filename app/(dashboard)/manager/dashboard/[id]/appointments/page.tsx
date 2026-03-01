"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  approveManagerAppointment,
  createManagerAppointmentPossession,
  filterManagerBranchStaff,
  getManagerAnalyticsBranches,
  getManagerBranchUsers,
  getManagerPendingAppointments,
  type ManagerBranchUser,
  type ManagerPendingAppointment,
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
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "CONFIRMED":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
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
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [appointments, setAppointments] = useState<ManagerPendingAppointment[]>([]);
  const [salespersons, setSalespersons] = useState<ManagerBranchUser[]>([]);
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
  }, [getAccessToken]);

  const loadAppointments = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId) {
        setAppointments([]);
        setSalespersons([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const [appointmentRows, branchUsers] = await Promise.all([
          getManagerPendingAppointments({
            accessToken,
            branchId: resolvedBranchId,
          }),
          getManagerBranchUsers({
            accessToken,
            branchId: resolvedBranchId,
          }),
        ]);

        setAppointments(appointmentRows);
        setSalespersons(filterManagerBranchStaff(branchUsers.users, ["SALES"]));
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
    },
    [branchId, getAccessToken],
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        await loadBranches();
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setBranchOptions([]);
        setAppointments([]);
        setSalespersons([]);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches]);

  useEffect(() => {
    if (branchId) {
      void loadAppointments(branchId);
    }
  }, [branchId, loadAppointments]);

  const salespersonsById = useMemo(() => {
    const bucket = new Map<string, ManagerBranchUser>();
    for (const row of salespersons) {
      bucket.set(row.userId, row);
    }
    return bucket;
  }, [salespersons]);

  const appointmentProductOptions = useMemo(() => {
    const bucket: Record<string, Array<{ id: string; label: string }>> = {};
    for (const appointment of appointments) {
      bucket[appointment.id] = appointment.items
        .map((item) => {
          const productId = item.productId || item.product?.id;
          if (!productId) {
            return null;
          }

          return {
            id: productId,
            label:
              [item.product?.sku, item.product?.name].filter(Boolean).join(" · ") ||
              productId,
          };
        })
        .filter((row): row is { id: string; label: string } => Boolean(row));
    }
    return bucket;
  }, [appointments]);

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
      await loadAppointments(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setUpdatingAppointmentId("");
    }
  };

  const onSubmitPossession = async (appointment: ManagerPendingAppointment) => {
    const draft = draftByAppointmentId[appointment.id];
    if (!draft?.productId || !draft?.salespersonUserId) {
      setError("Select both the appointment product and salesperson before checkout.");
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

      setNotice("Possession checked out to salesperson.");
      setExpandedAppointmentId("");
      setDraftByAppointmentId((current) => {
        const next = { ...current };
        delete next[appointment.id];
        return next;
      });
      await loadAppointments(branchId);
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
        description="Approve branch appointments, then allocate possessions from the appointment product lines."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              <option value="">Select branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void loadBranches();
                void loadAppointments(branchId);
              }}
              className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-900/15 p-4 text-sm text-amber-800 dark:text-amber-200">
        The current manager API does not expose a linked salesperson-to-manager possession request
        chain. The supported flow is: approve the appointment, request inventory if needed, then
        create the possession checkout for the salesperson.
      </div>

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
            const draft = draftByAppointmentId[appointment.id] || {
              productId: "",
              salespersonUserId: "",
              dueBackAt: "",
              note: "",
            };
            const isExpanded = expandedAppointmentId === appointment.id;
            const productOptions = appointmentProductOptions[appointment.id] || [];

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
                    {formatDateTime(appointment.appointmentDate)}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Appointment Items
                  </p>
                  {appointment.items.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      No items listed on this appointment.
                    </p>
                  ) : (
                    appointment.items.slice(0, 4).map((item) => (
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
                  onClick={() =>
                    setExpandedAppointmentId((current) =>
                      current === appointment.id ? "" : appointment.id,
                    )
                  }
                  className="w-full py-2 border border-emerald-200 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  {isExpanded ? "Hide Checkout Form" : "Allocate Possession"}
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
                        <option value="">Select appointment product</option>
                        {productOptions.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.label}
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
                        {salespersons.map((salesperson) => (
                          <option key={salesperson.userId} value={salesperson.userId}>
                            {salesperson.displayName ||
                              salesperson.email ||
                              salesperson.userId}
                          </option>
                        ))}
                      </select>
                    </div>

                    {draft.salespersonUserId && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Selected salesperson status:{" "}
                        {salespersonsById.get(draft.salespersonUserId)?.status || "UNKNOWN"}
                      </p>
                    )}

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
                      placeholder="Checkout note (optional)"
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
