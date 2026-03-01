"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerInventoryRequest,
  getManagerAnalyticsBranches,
  getManagerPendingAppointments,
  type ManagerInventoryRequestRecord,
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
    case "PENDING_MANAGER":
    case "PENDING_MAIN":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "APPROVED":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    case "REJECTED":
      return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

export default function ManagerInventory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [appointments, setAppointments] = useState<ManagerPendingAppointment[]>([]);
  const [submittedRequests, setSubmittedRequests] = useState<ManagerInventoryRequestRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [appointmentId, setAppointmentId] = useState("");
  const [appointmentItemId, setAppointmentItemId] = useState("");
  const [productId, setProductId] = useState("");
  const [manualProductId, setManualProductId] = useState("");
  const [fromLocation, setFromLocation] = useState<"MAIN" | "BRANCH_POOL">("MAIN");
  const [managerNote, setManagerNote] = useState("");

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

  const loadPendingAppointments = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId) {
        setAppointments([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const rows = await getManagerPendingAppointments({
          accessToken,
          branchId: resolvedBranchId,
        });
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
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches]);

  useEffect(() => {
    if (branchId) {
      void loadPendingAppointments(branchId);
    }
  }, [branchId, loadPendingAppointments]);

  const appointmentsForBranch = useMemo(
    () => appointments.filter((row) => row.branchId === branchId),
    [appointments, branchId],
  );

  const selectedAppointment = useMemo(
    () => appointments.find((row) => row.id === appointmentId) || null,
    [appointmentId, appointments],
  );

  const selectedAppointmentItems = useMemo(
    () =>
      (selectedAppointment?.items || [])
        .map((item) => {
          const resolvedProductId = item.productId || item.product?.id;
          return {
            id: item.id,
            productId: resolvedProductId,
            label:
              [item.product?.sku, item.product?.name].filter(Boolean).join(" · ") ||
              resolvedProductId ||
              item.id,
          };
        }),
    [selectedAppointment],
  );

  useEffect(() => {
    if (selectedAppointmentItems.length === 1) {
      setAppointmentItemId(selectedAppointmentItems[0].id);
      if (selectedAppointmentItems[0].productId) {
        setProductId(selectedAppointmentItems[0].productId);
      }
    }
  }, [selectedAppointmentItems]);

  const onSubmitRequest = async () => {
    setError("");
    setNotice("");

    const resolvedProductId = manualProductId.trim() || productId;

    if (!branchId || !appointmentId || !resolvedProductId) {
      setError("Branch, appointment, and product are required.");
      return;
    }

    setSubmitting(true);

    try {
      const accessToken = await getAccessToken();
      const request = await createManagerInventoryRequest({
        accessToken,
        branchId,
        appointmentId,
        productId: resolvedProductId,
        appointmentItemId: appointmentItemId || undefined,
        fromLocation,
        managerNote: managerNote || undefined,
      });

      if (request) {
        setSubmittedRequests((current) => [request, ...current].slice(0, 30));
      }

      setNotice("Inventory request submitted to the current main-admin stage.");
      setAppointmentItemId("");
      setProductId("");
      setManualProductId("");
      setManagerNote("");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Requests"
        description="Create manager inventory pull requests for appointment fulfillment."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setAppointmentId("");
                setAppointmentItemId("");
                setProductId("");
                setManualProductId("");
              }}
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
                void loadPendingAppointments(branchId);
              }}
              className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-900/15 p-4 text-sm text-amber-800 dark:text-amber-200">
        The current backend creates this request directly at the main-admin stage. There is no
        dedicated salesperson-originated request chain exposed in manager API yet, so this page
        reflects the current direct manager request behavior.
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

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Request</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <select
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setAppointmentId("");
              setAppointmentItemId("");
              setProductId("");
              setManualProductId("");
            }}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          >
            <option value="">Select branch</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.label}
              </option>
            ))}
          </select>

          <select
            value={appointmentId}
            onChange={(event) => {
              setAppointmentId(event.target.value);
              setAppointmentItemId("");
              setProductId("");
              setManualProductId("");
            }}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          >
            <option value="">Select appointment</option>
            {appointmentsForBranch.map((row) => (
              <option key={row.id} value={row.id}>
                {[row.id, row.customerName].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>

          <select
            value={appointmentItemId}
            onChange={(event) => {
              const nextItemId = event.target.value;
              setAppointmentItemId(nextItemId);
              const nextItem = selectedAppointmentItems.find((row) => row.id === nextItemId);
              setProductId(nextItem?.productId || "");
            }}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          >
            <option value="">Appointment item (optional)</option>
            {selectedAppointmentItems.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={manualProductId}
            onChange={(event) => setManualProductId(event.target.value)}
            placeholder={productId ? `Resolved product: ${productId}` : "Manual product ID override"}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          />

          <select
            value={fromLocation}
            onChange={(event) => setFromLocation(event.target.value as "MAIN" | "BRANCH_POOL")}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          >
            <option value="MAIN">MAIN</option>
            <option value="BRANCH_POOL">BRANCH_POOL</option>
          </select>

          <input
            type="text"
            value={managerNote}
            onChange={(event) => setManagerNote(event.target.value)}
            placeholder="Manager note (optional)"
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          />
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          If the appointment item already includes a product reference, it is resolved automatically.
          Use the manual override only when the item payload does not include a usable product ID.
        </p>

        <button
          type="button"
          onClick={() => void onSubmitRequest()}
          disabled={submitting || loading}
          className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting..." : "Submit Inventory Request"}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Recent Submitted Requests (This Session)
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            The manager usage contract documents request creation but not a manager-side read route
            for historical inventory requests, so this table reflects the current session only.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                <th className="px-5 py-3 font-medium">Request</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Appointment</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {submittedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No requests submitted in this session yet.
                  </td>
                </tr>
              ) : (
                submittedRequests.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {row.id}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(
                          row.status,
                        )}`}
                      >
                        {row.status || "PENDING"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.branchId || "-"}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.appointmentId || "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.productId || "-"}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {formatDateTime(row.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
