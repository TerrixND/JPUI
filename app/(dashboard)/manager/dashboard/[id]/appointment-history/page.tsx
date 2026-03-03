"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getManagerAnalyticsBranches,
  getManagerAppointments,
  type ManagerAppointmentHistoryRecord,
} from "@/lib/managerApi";
import {
  formatManagerDateTime,
  managerMoney,
  managerStatusBadge,
} from "@/lib/managerDashboardUi";

const APPOINTMENT_STATUS_OPTIONS = [
  "ALL",
  "REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

export default function ManagerAppointmentHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof APPOINTMENT_STATUS_OPTIONS)[number]>("ALL");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [records, setRecords] = useState<ManagerAppointmentHistoryRecord[]>([]);

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
    return options[0]?.id || "";
  }, [getAccessToken]);

  const loadRecords = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId) {
        setRecords([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const appointments = await getManagerAppointments({
          accessToken,
          branchId: resolvedBranchId,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          limit: 100,
        });
        setRecords(appointments);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setRecords([]);
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [branchId, getAccessToken, statusFilter],
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const firstBranchId = await loadBranches();
        await loadRecords(firstBranchId);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setBranchOptions([]);
        setRecords([]);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches, loadRecords]);

  useEffect(() => {
    if (branchId) {
      void loadRecords(branchId);
    }
  }, [branchId, loadRecords, statusFilter]);

  const summary = useMemo(() => {
    return records.reduce(
      (accumulator, record) => {
        accumulator.total += 1;
        accumulator.sales += record.sales.length;
        accumulator.value += record.sales.reduce(
          (sum, sale) => sum + (sale.amount ?? 0),
          0,
        );
        return accumulator;
      },
      { total: 0, sales: 0, value: 0 },
    );
  }, [records]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment History"
        description="Branch appointment history with accepted salesperson assignment and sale status details."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-900"
            >
              <option value="">Select branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as (typeof APPOINTMENT_STATUS_OPTIONS)[number])
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-900"
            >
              {APPOINTMENT_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void loadBranches();
                void loadRecords(branchId);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Refresh
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Appointments
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {summary.total}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Linked Sales
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {summary.sales}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Sales Value
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {managerMoney.format(summary.value)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Appointment</th>
                <th className="px-5 py-3 font-medium">Accepted By</th>
                <th className="px-5 py-3 font-medium">Sale Status</th>
                <th className="px-5 py-3 font-medium">Items</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading appointment history...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No appointments matched this branch and status filter.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {record.customerName || "Walk-in customer"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {record.customerEmail || record.customerPhone || "-"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${managerStatusBadge(record.status)}`}
                      >
                        {record.status || "UNKNOWN"}
                      </span>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {formatManagerDateTime(record.appointmentDate)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {record.assignedSalesperson?.displayName ||
                        record.assignedSalesperson?.user?.email ||
                        "-"}
                    </td>
                    <td className="px-5 py-4">
                      {record.sales.length === 0 ? (
                        <span className="text-gray-400 dark:text-gray-500">No sales linked</span>
                      ) : (
                        <div className="space-y-1">
                          {record.sales.slice(0, 3).map((sale) => (
                            <div key={sale.id} className="text-xs">
                              <span
                                className={`rounded-full px-2 py-0.5 font-semibold ${managerStatusBadge(sale.status)}`}
                              >
                                {sale.status || "UNKNOWN"}
                              </span>
                              <span className="ml-2 text-gray-500 dark:text-gray-400">
                                {sale.amount !== null ? managerMoney.format(sale.amount) : "-"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {record.items.length
                        ? record.items
                            .slice(0, 3)
                            .map((item) => item.product?.name || item.product?.sku || item.productId || item.id)
                            .join(", ")
                        : "-"}
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
