"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getManagerDashboardSalespersons,
  getManagerSalespersonPerformance,
  getManagerSalespersonPossessions,
  updateManagerSalespersonStatus,
  type ManagerDashboardSalespersonsResponse,
  type ManagerPossessionRecord,
  type ManagerSalespersonListItem,
  type ManagerSalespersonPerformance,
} from "@/lib/managerApi";

const STATUS_OPTIONS = ["ALL", "ACTIVE", "RESTRICTED", "BANNED", "TERMINATED"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

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

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const statusBadge = (status: string | null) => {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    case "RESTRICTED":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
    case "BANNED":
      return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    case "TERMINATED":
      return "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

const findSelectedSalesperson = (
  rows: ManagerSalespersonListItem[],
  userId: string,
) => rows.find((entry) => entry.userId === userId) || null;

export default function ManagerSalespersons() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [branchFilter, setBranchFilter] = useState("");
  const [responseMeta, setResponseMeta] = useState<ManagerDashboardSalespersonsResponse | null>(
    null,
  );
  const [rows, setRows] = useState<ManagerSalespersonListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [performance, setPerformance] = useState<ManagerSalespersonPerformance | null>(null);
  const [possessions, setPossessions] = useState<ManagerPossessionRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusDraft, setStatusDraft] = useState<"ACTIVE" | "RESTRICTED" | "BANNED" | "TERMINATED">(
    "ACTIVE",
  );
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

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

  const loadSalespersons = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getManagerDashboardSalespersons({
        accessToken,
        branchId: branchFilter || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });

      setResponseMeta(response);
      setRows(response.salespersons);
      setSelectedUserId((current) => {
        if (current && response.salespersons.some((entry) => entry.userId === current)) {
          return current;
        }

        return response.salespersons[0]?.userId || "";
      });
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setResponseMeta(null);
      setRows([]);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [branchFilter, getAccessToken, statusFilter]);

  useEffect(() => {
    void loadSalespersons();
  }, [loadSalespersons]);

  const selectedSalesperson = useMemo(
    () => findSelectedSalesperson(rows, selectedUserId),
    [rows, selectedUserId],
  );

  useEffect(() => {
    if (!selectedSalesperson) {
      setPerformance(null);
      setPossessions([]);
      setStatusReason("");
      return;
    }

    setStatusDraft(
      selectedSalesperson.status === "ACTIVE" ||
        selectedSalesperson.status === "RESTRICTED" ||
        selectedSalesperson.status === "BANNED" ||
        selectedSalesperson.status === "TERMINATED"
        ? selectedSalesperson.status
        : "ACTIVE",
    );
  }, [selectedSalesperson]);

  const loadSalespersonDetail = useCallback(async () => {
    if (!selectedSalesperson) {
      return;
    }

    setDetailLoading(true);
    setDetailError("");

    try {
      const accessToken = await getAccessToken();
      const [performanceRow, possessionRows] = await Promise.all([
        getManagerSalespersonPerformance({
          accessToken,
          salespersonUserId: selectedSalesperson.userId,
          branchId: selectedSalesperson.branchId || undefined,
        }),
        getManagerSalespersonPossessions({
          accessToken,
          salespersonUserId: selectedSalesperson.userId,
          branchId: selectedSalesperson.branchId || undefined,
        }),
      ]);

      setPerformance(performanceRow);
      setPossessions(possessionRows);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setPerformance(null);
      setPossessions([]);
      setDetailError(getErrorMessage(caughtError));
    } finally {
      setDetailLoading(false);
    }
  }, [getAccessToken, selectedSalesperson]);

  useEffect(() => {
    void loadSalespersonDetail();
  }, [loadSalespersonDetail]);

  const branchOptions = useMemo(() => {
    const dedupe = new Map<string, string>();
    for (const row of rows) {
      if (!row.branch?.id) continue;
      dedupe.set(
        row.branch.id,
        [row.branch.code, row.branch.name].filter(Boolean).join(" · ") || row.branch.id,
      );
    }
    return Array.from(dedupe.entries()).map(([id, label]) => ({ id, label }));
  }, [rows]);

  const onUpdateStatus = async () => {
    if (!selectedSalesperson) {
      return;
    }

    setStatusSubmitting(true);
    setError("");
    setDetailError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const result = await updateManagerSalespersonStatus({
        accessToken,
        salespersonUserId: selectedSalesperson.userId,
        status: statusDraft,
        reason: statusReason || undefined,
        branchId: selectedSalesperson.branchId || undefined,
      });

      setNotice(
        result.message ||
          (result.statusCode === 202
            ? "Status action submitted for approval."
            : "Salesperson status updated."),
      );
      setStatusReason("");
      await loadSalespersons();
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setDetailError(getErrorMessage(caughtError));
    } finally {
      setStatusSubmitting(false);
    }
  };

  const counts = responseMeta?.counts || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salesperson Management"
        description="Live roster, status controls, performance, and possession history."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              <option value="">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadSalespersons()}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_OPTIONS.filter((option) => option !== "ALL").map((option) => (
          <div
            key={option}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4"
          >
            <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {option}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {counts[option] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                  <th className="px-5 py-3 font-medium">Salesperson</th>
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Assigned</th>
                  <th className="px-5 py-3 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      Loading salespersons...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                      No salespersons found in scope.
                    </td>
                  </tr>
                ) : (
                  rows.map((salesperson) => (
                    <tr
                      key={salesperson.membershipId}
                      className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                        salesperson.userId === selectedUserId
                          ? "bg-emerald-50/60 dark:bg-emerald-900/10"
                          : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {salesperson.displayName || salesperson.email || salesperson.userId}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {salesperson.email || salesperson.userId}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {salesperson.branch?.name || salesperson.branchId || "-"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                            salesperson.status,
                          )}`}
                        >
                          {salesperson.status || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                        {formatDateTime(salesperson.assignedAt)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(salesperson.userId)}
                          className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Status Action</h3>
            {!selectedSalesperson ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select a salesperson to manage status and view detail.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedSalesperson.displayName ||
                    selectedSalesperson.email ||
                    selectedSalesperson.userId}
                </p>
                <select
                  value={statusDraft}
                  onChange={(event) =>
                    setStatusDraft(
                      event.target.value as
                        | "ACTIVE"
                        | "RESTRICTED"
                        | "BANNED"
                        | "TERMINATED",
                    )
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="BANNED">BANNED</option>
                  <option value="TERMINATED">TERMINATED</option>
                </select>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => void onUpdateStatus()}
                  disabled={statusSubmitting}
                  className="w-full py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {statusSubmitting ? "Submitting..." : "Apply Status Action"}
                </button>
              </>
            )}

            {detailError && (
              <p className="text-xs text-red-600 dark:text-red-400">{detailError}</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Performance
              </h3>
              {selectedSalesperson && (
                <button
                  type="button"
                  onClick={() => void loadSalespersonDetail()}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200"
                >
                  Refresh
                </button>
              )}
            </div>

            {detailLoading ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading details...</p>
            ) : !performance ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No performance record loaded.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sales Count</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {performance.salesTotalCount}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sales Amount</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {money.format(performance.salesTotalAmount)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wider">Commission Count</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {performance.commissionsTotalCount}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wider">Commission Amount</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {money.format(performance.commissionsTotalAmount)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Possessions</h3>
            {detailLoading ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading possessions...</p>
            ) : possessions.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No possession history in scope.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {possessions.slice(0, 12).map((row) => (
                  <div
                    key={row.id}
                    className="border border-gray-200 dark:border-gray-700/60 rounded-lg p-2 bg-gray-50 dark:bg-gray-800/40"
                  >
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {row.product?.name || row.product?.sku || row.id}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {row.status || "-"} · {formatDateTime(row.checkedOutAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
