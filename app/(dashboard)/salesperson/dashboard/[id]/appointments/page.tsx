"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getSalespersonAppointments,
  type SalespersonAppointmentRecord,
  type SalespersonAppointmentStatus,
  updateSalespersonAppointmentStatus,
} from "@/lib/salespersonApi";
import supabase from "@/lib/supabase";

const FILTERS = [
  { id: "ACTIVE", label: "Active" },
  { id: "ALL", label: "All" },
  { id: "REQUESTED", label: "Requested" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "NO_SHOW", label: "No Show" },
] as const;

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

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
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "CONFIRMED":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    case "COMPLETED":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
    case "CANCELLED":
      return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    case "NO_SHOW":
      return "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

const contactBadgeStyle = (preferredContact: string | null) => {
  switch (preferredContact) {
    case "LINE":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    case "PHONE":
      return "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300";
    case "EMAIL":
      return "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

const nextActionsForStatus = (
  status: string | null,
): Array<{ status: SalespersonAppointmentStatus; label: string; tone: string }> => {
  if (status === "REQUESTED") {
    return [
      {
        status: "CONFIRMED",
        label: "Confirm",
        tone: "bg-emerald-600 hover:bg-emerald-700 text-white",
      },
      {
        status: "CANCELLED",
        label: "Cancel",
        tone:
          "bg-white dark:bg-gray-900 border border-red-200 dark:border-red-700/60 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20",
      },
    ];
  }

  if (status === "CONFIRMED") {
    return [
      {
        status: "COMPLETED",
        label: "Complete",
        tone: "bg-blue-600 hover:bg-blue-700 text-white",
      },
      {
        status: "NO_SHOW",
        label: "No Show",
        tone:
          "bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
      },
      {
        status: "CANCELLED",
        label: "Cancel",
        tone:
          "bg-white dark:bg-gray-900 border border-red-200 dark:border-red-700/60 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20",
      },
    ];
  }

  return [];
};

const branchLabel = (appointment: SalespersonAppointmentRecord) =>
  [appointment.branch?.code, appointment.branch?.name].filter(Boolean).join(" · ") ||
  appointment.branchId ||
  "-";

const contactDetails = (appointment: SalespersonAppointmentRecord) => {
  switch (appointment.preferredContact) {
    case "LINE":
      return appointment.customerLineId || "Connected LINE account";
    case "PHONE":
      return appointment.customerPhone || "-";
    case "EMAIL":
      return appointment.customerEmail || "-";
    default:
      return appointment.customerEmail || appointment.customerPhone || appointment.customerLineId || "-";
  }
};

const hasSuccessfulSale = (appointment: SalespersonAppointmentRecord) =>
  appointment.sales.some((sale) => sale.status === "SUCCESSFUL");

const isActiveAppointment = (appointment: SalespersonAppointmentRecord) =>
  !hasSuccessfulSale(appointment) &&
  appointment.status !== "CANCELLED" &&
  appointment.status !== "NO_SHOW";

export default function SalespersonAppointments() {
  const router = useRouter();
  const { dashboardBasePath } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<(typeof FILTERS)[number]["id"]>("ACTIVE");
  const [appointments, setAppointments] = useState<SalespersonAppointmentRecord[]>([]);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState("");

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

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const rows = await getSalespersonAppointments({ accessToken });
      setAppointments(rows);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setAppointments([]);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const filteredAppointments = useMemo(() => {
    if (activeFilter === "ACTIVE") {
      return appointments.filter((appointment) => isActiveAppointment(appointment));
    }

    if (activeFilter === "ALL") {
      return appointments;
    }

    return appointments.filter((appointment) => appointment.status === activeFilter);
  }, [activeFilter, appointments]);

  const onUpdateStatus = async (
    appointmentId: string,
    nextStatus: SalespersonAppointmentStatus,
  ) => {
    setUpdatingAppointmentId(appointmentId);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await updateSalespersonAppointmentStatus({
        accessToken,
        appointmentId,
        status: nextStatus,
      });

      if (nextStatus === "CONFIRMED" && response.lineConversationId) {
        router.push(
          `${dashboardBasePath}/line?conversationId=${encodeURIComponent(
            response.lineConversationId,
          )}`,
        );
        return;
      }

      const nextNotice =
        nextStatus === "COMPLETED"
          ? "Appointment marked as completed."
          : nextStatus === "NO_SHOW"
            ? "Appointment marked as no show."
            : nextStatus === "CANCELLED"
              ? "Appointment cancelled."
              : "Appointment confirmed.";

      setNotice(nextNotice);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        description="Track active appointments until they are sold successfully or closed."
        action={
          <button
            type="button"
            onClick={() => {
              void loadAppointments();
            }}
            className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Refresh
          </button>
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

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFilter === filter.id
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/70"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-2xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900"
            />
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-8 text-sm text-gray-500 dark:text-gray-400">
          No appointments matched the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredAppointments.map((appointment) => {
            const actions = nextActionsForStatus(appointment.status);
            const isUpdating = updatingAppointmentId === appointment.id;

            return (
              <article
                key={appointment.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="font-mono text-xs text-gray-400 dark:text-gray-500">
                      {appointment.id}
                    </p>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {appointment.customerName || "Customer"}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {branchLabel(appointment)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(
                        appointment.status,
                      )}`}
                    >
                      {appointment.status || "UNKNOWN"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${contactBadgeStyle(
                        appointment.preferredContact,
                      )}`}
                    >
                      {appointment.preferredContact || "CONTACT"}
                    </span>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-4 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Appointment
                    </dt>
                    <dd className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                      {formatDateTime(appointment.appointmentDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Contact
                    </dt>
                    <dd className="mt-1 break-all">{contactDetails(appointment)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Email
                    </dt>
                    <dd className="mt-1 break-all">{appointment.customerEmail || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Items
                    </dt>
                    <dd className="mt-1">
                      {appointment.items.length} item
                      {appointment.items.length === 1 ? "" : "s"}
                    </dd>
                  </div>
                </dl>

                {appointment.notes && (
                  <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {appointment.notes}
                  </div>
                )}

                {appointment.preferredContact === "LINE" &&
                  appointment.status === "REQUESTED" && (
                    <div className="mt-4 rounded-xl border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-300">
                      Confirming this appointment will open the LINE inbox so you can continue the conversation immediately.
                    </div>
                  )}

                {hasSuccessfulSale(appointment) ? (
                  <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                    This appointment already has a successful sale record and can move out of the active workflow.
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  {actions.length === 0 ? (
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      No further status actions available.
                    </span>
                  ) : (
                    actions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void onUpdateStatus(appointment.id, action.status)}
                        className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${action.tone}`}
                      >
                        {isUpdating ? "Updating..." : action.label}
                      </button>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
