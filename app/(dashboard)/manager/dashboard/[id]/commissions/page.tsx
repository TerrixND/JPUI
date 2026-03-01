"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerCommissionPolicy,
  filterManagerBranchStaff,
  getManagerAnalyticsBranches,
  getManagerBranchUsers,
  getManagerProducts,
  getManagerSalespersonPerformance,
  type ManagerBranchAnalyticsRecord,
  type ManagerBranchUser,
  type ManagerCommissionPolicyRecord,
  type ManagerProductSummary,
  type ManagerSalespersonPerformance,
} from "@/lib/managerApi";

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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

export default function ManagerCommissions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [salespersons, setSalespersons] = useState<ManagerBranchUser[]>([]);
  const [products, setProducts] = useState<ManagerProductSummary[]>([]);
  const [branchAnalytics, setBranchAnalytics] =
    useState<ManagerBranchAnalyticsRecord | null>(null);
  const [createdPolicies, setCreatedPolicies] = useState<ManagerCommissionPolicyRecord[]>([]);
  const [performance, setPerformance] = useState<ManagerSalespersonPerformance | null>(null);

  const [salespersonUserId, setSalespersonUserId] = useState("");
  const [rate, setRate] = useState("7");
  const [productTier, setProductTier] = useState("");
  const [productId, setProductId] = useState("");
  const [activeFrom, setActiveFrom] = useState("");
  const [activeTo, setActiveTo] = useState("");
  const [priority, setPriority] = useState("100");
  const [note, setNote] = useState("");

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

  const loadBranchContext = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId) {
        setSalespersons([]);
        setProducts([]);
        setBranchAnalytics(null);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const [branchUsers, productResponse, analytics] = await Promise.all([
          getManagerBranchUsers({
            accessToken,
            branchId: resolvedBranchId,
          }),
          getManagerProducts({
            accessToken,
            branchId: resolvedBranchId,
          }),
          getManagerAnalyticsBranches({
            accessToken,
            branchId: resolvedBranchId,
          }),
        ]);

        const salesRows = filterManagerBranchStaff(branchUsers.users, ["SALES"]);
        setSalespersons(salesRows);
        setProducts(productResponse.products);
        setBranchAnalytics(analytics.branches[0] || null);
        setSalespersonUserId((current) => {
          if (current && salesRows.some((row) => row.userId === current)) {
            return current;
          }
          return salesRows[0]?.userId || "";
        });
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setSalespersons([]);
        setProducts([]);
        setBranchAnalytics(null);
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
        setSalespersons([]);
        setProducts([]);
        setBranchAnalytics(null);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches]);

  useEffect(() => {
    if (branchId) {
      void loadBranchContext(branchId);
    }
  }, [branchId, loadBranchContext]);

  useEffect(() => {
    if (!salespersonUserId || !branchId) {
      setPerformance(null);
      return;
    }

    const loadPerformance = async () => {
      setPerformanceLoading(true);
      try {
        const accessToken = await getAccessToken();
        const result = await getManagerSalespersonPerformance({
          accessToken,
          salespersonUserId,
          branchId,
        });
        setPerformance(result);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setPerformance(null);
        setError(getErrorMessage(caughtError));
      } finally {
        setPerformanceLoading(false);
      }
    };

    void loadPerformance();
  }, [branchId, getAccessToken, salespersonUserId]);

  const onCreatePolicy = async () => {
    setError("");
    setNotice("");

    const parsedRate = Number(rate);
    if (!branchId || !salespersonUserId || Number.isNaN(parsedRate)) {
      setError("Branch, salesperson, and a valid rate are required.");
      return;
    }

    if (parsedRate < 0 || parsedRate > 100) {
      setError("Rate must be between 0 and 100.");
      return;
    }

    const parsedPriority = priority.trim() ? Number(priority) : undefined;
    if (
      parsedPriority !== undefined &&
      (Number.isNaN(parsedPriority) || !Number.isFinite(parsedPriority))
    ) {
      setError("Priority must be a valid number.");
      return;
    }

    setSubmitting(true);

    try {
      const accessToken = await getAccessToken();
      const result = await createManagerCommissionPolicy({
        accessToken,
        branchId,
        salespersonUserId,
        rate: parsedRate,
        productTier: productTier || undefined,
        productId: productId || undefined,
        activeFrom: activeFrom ? new Date(activeFrom).toISOString() : undefined,
        activeTo: activeTo ? new Date(activeTo).toISOString() : undefined,
        priority: parsedPriority,
        note: note || undefined,
      });

      if (result) {
        setCreatedPolicies((current) => [result, ...current].slice(0, 30));
      }

      setNotice("Commission policy created.");
      setProductTier("");
      setProductId("");
      setActiveFrom("");
      setActiveTo("");
      setNote("");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSalesperson = useMemo(
    () => salespersons.find((row) => row.userId === salespersonUserId) || null,
    [salespersonUserId, salespersons],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Policies"
        description="Create default, tier-specific, or product-specific salesperson commission rules."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setSalespersonUserId("");
                setProductId("");
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
                void loadBranchContext(branchId);
              }}
              className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-900/15 p-4 text-sm text-amber-800 dark:text-amber-200">
        Product-specific quick picks on this page come from the current manager <span className="font-semibold">/products</span> route,
        which only returns <span className="font-semibold">PRIVATE</span> products today. That is
        a backend limitation, so the form keeps the behavior explicit instead of pretending it has a
        wider manager catalog.
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-5">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Create Policy</h2>

          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading branch scope...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <select
                  value={salespersonUserId}
                  onChange={(event) => setSalespersonUserId(event.target.value)}
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                >
                  <option value="">Select salesperson</option>
                  {salespersons.map((row) => (
                    <option key={row.userId} value={row.userId}>
                      {row.displayName || row.email || row.userId}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  placeholder="Rate (0..100)"
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />

                <input
                  type="number"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  placeholder="Priority (default 100)"
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />

                <select
                  value={productTier}
                  onChange={(event) => {
                    setProductTier(event.target.value);
                    if (event.target.value) {
                      setProductId("");
                    }
                  }}
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                >
                  <option value="">Default rule</option>
                  <option value="STANDARD">STANDARD</option>
                  <option value="VIP">VIP</option>
                  <option value="ULTRA_RARE">ULTRA_RARE</option>
                </select>

                <select
                  value={productId}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    if (event.target.value) {
                      setProductTier("");
                    }
                  }}
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                >
                  <option value="">Product-specific rule (optional)</option>
                  {products.map((row) => (
                    <option key={row.id} value={row.id}>
                      {[row.sku, row.name].filter(Boolean).join(" · ") || row.id}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Note (optional)"
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />

                <input
                  type="datetime-local"
                  value={activeFrom}
                  onChange={(event) => setActiveFrom(event.target.value)}
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />
                <input
                  type="datetime-local"
                  value={activeTo}
                  onChange={(event) => setActiveTo(event.target.value)}
                  className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Leave both tier and product empty for the default salesperson rule. Selecting a
                product clears the tier field because product-level rules take precedence.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={() => void onCreatePolicy()}
            disabled={submitting || loading}
            className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting..." : "Create Commission Policy"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Branch Value Range</h3>
            {!branchAnalytics ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select a branch to view product selection value ranges.
              </p>
            ) : (
              <div className="space-y-1 text-xs">
                <p className="text-gray-500 dark:text-gray-400">
                  Selected products: {branchAnalytics.summary.selectedProductsCount}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Sale range:{" "}
                  <span className="font-semibold">
                    {money.format(branchAnalytics.summary.totalSaleRangeMin)} -{" "}
                    {money.format(branchAnalytics.summary.totalSaleRangeMax)}
                  </span>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Commission range:{" "}
                  <span className="font-semibold">
                    {money.format(branchAnalytics.summary.totalCommissionRangeMin)} -{" "}
                    {money.format(branchAnalytics.summary.totalCommissionRangeMax)}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Salesperson Performance
            </h3>
            {!selectedSalesperson ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select a salesperson to load current performance.
              </p>
            ) : performanceLoading ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading performance...</p>
            ) : !performance ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No performance payload returned for the selected salesperson.
              </p>
            ) : (
              <div className="space-y-1 text-xs">
                <p className="text-gray-700 dark:text-gray-300">
                  Sales: {performance.salesTotalCount} ·{" "}
                  <span className="font-semibold">{money.format(performance.salesTotalAmount)}</span>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Commissions: {performance.commissionsTotalCount} ·{" "}
                  <span className="font-semibold">
                    {money.format(performance.commissionsTotalAmount)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Recent Created Policies (This Session)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                <th className="px-5 py-3 font-medium">Policy</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Salesperson</th>
                <th className="px-5 py-3 font-medium">Rate</th>
                <th className="px-5 py-3 font-medium">Scope</th>
                <th className="px-5 py-3 font-medium">Active From</th>
              </tr>
            </thead>
            <tbody>
              {createdPolicies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No commission policies created in this session yet.
                  </td>
                </tr>
              ) : (
                createdPolicies.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{row.id}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.branchId || "-"}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.salespersonUserId || "-"}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{row.rate ?? "-"}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.productId || row.productTier || "Default"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {formatDateTime(row.activeFrom)}
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
