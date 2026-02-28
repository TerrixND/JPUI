"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerInventoryRequest,
  getManagerPendingAppointments,
  getManagerProducts,
  type ManagerInventoryRequestRecord,
  type ManagerPendingAppointment,
  type ManagerProductSummary,
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
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
    case "APPROVED":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
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
  const [appointments, setAppointments] = useState<ManagerPendingAppointment[]>([]);
  const [productsByBranch, setProductsByBranch] = useState<
    Record<string, ManagerProductSummary[]>
  >({});
  const [submittedRequests, setSubmittedRequests] = useState<ManagerInventoryRequestRecord[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [appointmentItemId, setAppointmentItemId] = useState("");
  const [productId, setProductId] = useState("");
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

  const loadPendingAppointments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const rows = await getManagerPendingAppointments({ accessToken });
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
    void loadPendingAppointments();
  }, [loadPendingAppointments]);

  const branchOptions = useMemo(() => {
    const dedupe = new Map<string, string>();
    for (const row of appointments) {
      if (!row.branch?.id) continue;
      dedupe.set(
        row.branch.id,
        [row.branch.code, row.branch.name].filter(Boolean).join(" · ") || row.branch.id,
      );
    }
    return Array.from(dedupe.entries()).map(([id, label]) => ({ id, label }));
  }, [appointments]);

  const appointmentsForBranch = useMemo(
    () => appointments.filter((row) => !branchId || row.branchId === branchId),
    [appointments, branchId],
  );

  const selectedAppointment = useMemo(
    () => appointments.find((row) => row.id === appointmentId) || null,
    [appointmentId, appointments],
  );

  const selectedAppointmentItems = selectedAppointment?.items || [];

  const ensureProductsForBranch = useCallback(
    async (nextBranchId: string) => {
      if (!nextBranchId || productsByBranch[nextBranchId]) {
        return;
      }

      const accessToken = await getAccessToken();
      const response = await getManagerProducts({
        accessToken,
        branchId: nextBranchId,
      });

      setProductsByBranch((current) => ({
        ...current,
        [nextBranchId]: response.products,
      }));
    },
    [getAccessToken, productsByBranch],
  );

  useEffect(() => {
    if (branchId) {
      void ensureProductsForBranch(branchId);
    }
  }, [branchId, ensureProductsForBranch]);

  useEffect(() => {
    if (!selectedAppointment) {
      return;
    }

    if (selectedAppointment.branchId && selectedAppointment.branchId !== branchId) {
      setBranchId(selectedAppointment.branchId);
    }

    if (selectedAppointment.items.length === 1) {
      setAppointmentItemId(selectedAppointment.items[0].id);
    }
  }, [branchId, selectedAppointment]);

  const onSubmitRequest = async () => {
    setError("");
    setNotice("");

    if (!branchId || !appointmentId || !productId) {
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
        productId,
        appointmentItemId: appointmentItemId || undefined,
        fromLocation,
        managerNote: managerNote || undefined,
      });

      if (request) {
        setSubmittedRequests((current) => [request, ...current].slice(0, 30));
      }

      setNotice("Inventory request submitted.");
      setAppointmentItemId("");
      setManagerNote("");
      setProductId("");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  const productOptions = branchId ? productsByBranch[branchId] || [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Requests"
        description="Create manager inventory pull requests from MAIN or BRANCH_POOL."
        action={
          <button
            type="button"
            onClick={() => void loadPendingAppointments()}
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
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          >
            <option value="">Select product</option>
            {productOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {[row.sku, row.name].filter(Boolean).join(" · ") || row.id}
              </option>
            ))}
          </select>

          <select
            value={appointmentItemId}
            onChange={(event) => setAppointmentItemId(event.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
          >
            <option value="">Appointment item (optional)</option>
            {selectedAppointmentItems.map((row) => (
              <option key={row.id} value={row.id}>
                {[row.id, row.product?.name || row.productId].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>

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
