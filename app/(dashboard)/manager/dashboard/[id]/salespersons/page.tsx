"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  filterManagerBranchStaff,
  getManagerAnalyticsBranches,
  getManagerBranchUsers,
  getManagerSalespersonPerformance,
  getManagerSalespersonPossessions,
  type ManagerBranchUser,
  type ManagerPossessionRecord,
  type ManagerSalespersonPerformance,
} from "@/lib/managerApi";

const STATUS_OPTIONS = ["ACTIVE", "RESTRICTED", "BANNED", "TERMINATED"] as const;
type StatusFilter = "ALL" | (typeof STATUS_OPTIONS)[number];

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
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    case "RESTRICTED":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "BANNED":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    case "TERMINATED":
      return "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

export default function ManagerSalespersons() {
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [branchId, setBranchId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [rows, setRows] = useState<ManagerBranchUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [performance, setPerformance] = useState<ManagerSalespersonPerformance | null>(null);
  const [possessions, setPossessions] = useState<ManagerPossessionRecord[]>([]);

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

  const loadSalespersons = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId) {
        setRows([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const branchUsers = await getManagerBranchUsers({
          accessToken,
          branchId: resolvedBranchId,
        });
        const salesRows = filterManagerBranchStaff(branchUsers.users, ["SALES"]).filter(
          (row) => (statusFilter === "ALL" ? true : row.status === statusFilter),
        );

        setRows(salesRows);
        setSelectedUserId((current) => {
          if (current && salesRows.some((row) => row.userId === current)) {
            return current;
          }
          return salesRows[0]?.userId || "";
        });
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setRows([]);
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
        await loadSalespersons(firstBranchId);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setBranchOptions([]);
        setRows([]);
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches, loadSalespersons]);

  useEffect(() => {
    if (branchId) {
      void loadSalespersons(branchId);
    }
  }, [branchId, loadSalespersons, statusFilter]);

  const selectedSalesperson = useMemo(
    () => rows.find((row) => row.userId === selectedUserId) || null,
    [rows, selectedUserId],
  );

  const loadDetail = useCallback(async () => {
    if (!selectedSalesperson || !branchId) {
      setPerformance(null);
      setPossessions([]);
      return;
    }

    setDetailLoading(true);
    setDetailError("");

    try {
      const accessToken = await getAccessToken();
      const [nextPerformance, nextPossessions] = await Promise.all([
        getManagerSalespersonPerformance({
          accessToken,
          salespersonUserId: selectedSalesperson.userId,
          branchId,
        }),
        getManagerSalespersonPossessions({
          accessToken,
          salespersonUserId: selectedSalesperson.userId,
          branchId,
        }),
      ]);

      setPerformance(nextPerformance);
      setPossessions(nextPossessions);
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
  }, [branchId, getAccessToken, selectedSalesperson]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const option of STATUS_OPTIONS) {
      next[option] = rows.filter((row) => row.status === option).length;
    }
    return next;
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Team"
        description="Branch salesperson roster, commission context, performance, and possession history."
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
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              <option value="ALL">ALL</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void loadBranches();
                void loadSalespersons(branchId);
              }}
              className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-blue-200 dark:border-blue-700/50 bg-blue-50/70 dark:bg-blue-900/15 p-4 text-sm text-blue-800 dark:text-blue-200">
        This page stays read-focused because salesperson status changes are not part of the
        current documented manager API. The roster, performance, and possession data are
        wired directly to supported manager routes.
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_OPTIONS.map((option) => (
          <div
            key={option}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4"
          >
            <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {option}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {counts[option] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-5">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                  <th className="px-5 py-3 font-medium">Salesperson</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Assigned</th>
                  <th className="px-5 py-3 font-medium">Commission Policies</th>
                  <th className="px-5 py-3 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      Loading branch sales roster...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                      No sales memberships found in the selected branch scope.
                    </td>
                  </tr>
                ) : (
                  rows.map((salesperson) => (
                    <tr
                      key={salesperson.membershipId}
                      className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                        salesperson.userId === selectedUserId
                          ? "bg-emerald-50/50 dark:bg-emerald-900/10"
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
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(
                            salesperson.status,
                          )}`}
                        >
                          {salesperson.status || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                        {formatDateTime(salesperson.assignedAt)}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {salesperson.commissionSummary.activeSalespersonPolicyCount}
                        <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                          active
                        </span>
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Membership Summary
            </h3>
            {!selectedSalesperson ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select a salesperson to load branch membership details.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedSalesperson.displayName ||
                    selectedSalesperson.email ||
                    selectedSalesperson.userId}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  Restrictions: {selectedSalesperson.accessRestrictionCount}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  Salesperson policies:{" "}
                  {selectedSalesperson.commissionSummary.salespersonPolicyCount}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  Product allocations:{" "}
                  {selectedSalesperson.commissionSummary.productAllocationCount}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  Highest active rate:{" "}
                  {selectedSalesperson.commissionSummary.highestActivePolicyRate ?? "-"}%
                </p>
              </div>
            )}
            {detailError && (
              <p className="text-xs text-red-600 dark:text-red-400">{detailError}</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Performance
              </h3>
              {selectedSalesperson && (
                <button
                  type="button"
                  onClick={() => void loadDetail()}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200"
                >
                  Refresh
                </button>
              )}
            </div>
            {detailLoading ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading detail...</p>
            ) : !performance ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No performance record loaded for the selected salesperson.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                  <p className="uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Sales count
                  </p>
                  <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {performance.salesTotalCount}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                  <p className="uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Sales amount
                  </p>
                  <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {money.format(performance.salesTotalAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                  <p className="uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Commission count
                  </p>
                  <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {performance.commissionsTotalCount}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                  <p className="uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Commission amount
                  </p>
                  <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {money.format(performance.commissionsTotalAmount)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Possessions
            </h3>
            {detailLoading ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading possessions...</p>
            ) : possessions.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No possession records found in the selected branch scope.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {possessions.slice(0, 12).map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700/60 p-3 bg-gray-50 dark:bg-gray-800/40"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.product?.name || row.product?.sku || row.id}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {row.status || "-"} · checked out {formatDateTime(row.checkedOutAt)}
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
