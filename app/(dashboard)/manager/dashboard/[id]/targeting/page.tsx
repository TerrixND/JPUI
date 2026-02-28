"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerBranchProductRequest,
  getManagerBranchProductRequests,
  getManagerDashboard,
  getManagerProducts,
  updateManagerProductTargeting,
  type ManagerBranchProductRequestRecord,
  type ManagerDashboardBranch,
  type ManagerProductSummary,
} from "@/lib/managerApi";

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const statusStyle = (status: string | null) => {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
    case "APPROVED":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    case "REJECTED":
      return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    case "CANCELLED":
      return "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

export default function ManagerTargeting() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branches, setBranches] = useState<ManagerDashboardBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [products, setProducts] = useState<ManagerProductSummary[]>([]);
  const [requests, setRequests] = useState<ManagerBranchProductRequestRecord[]>([]);
  const [targetingSubmitting, setTargetingSubmitting] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC" | "TOP_SHELF" | "TARGETED">(
    "TARGETED",
  );
  const [minCustomerTier, setMinCustomerTier] = useState<"" | "REGULAR" | "VIP" | "ULTRA_VIP">(
    "",
  );
  const [targetUserIds, setTargetUserIds] = useState("");
  const [visibilityNote, setVisibilityNote] = useState("");

  const [requestProductIds, setRequestProductIds] = useState<string[]>([]);
  const [requestedCommissionRate, setRequestedCommissionRate] = useState("");
  const [requestNote, setRequestNote] = useState("");

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
    try {
      const accessToken = await getAccessToken();
      const dashboard = await getManagerDashboard({ accessToken });
      setBranches(dashboard.branches);

      if (!branchId && dashboard.branches[0]?.id) {
        setBranchId(dashboard.branches[0].id);
      }
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setBranches([]);
      setError(getErrorMessage(caughtError));
    }
  }, [branchId, getAccessToken]);

  const loadProductsAndRequests = useCallback(async () => {
    if (!branchId) {
      setProducts([]);
      setRequests([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const [productResponse, requestResponse] = await Promise.all([
        getManagerProducts({
          accessToken,
          branchId,
        }),
        getManagerBranchProductRequests({
          accessToken,
          branchId,
          limit: 50,
        }),
      ]);

      setProducts(productResponse.products);
      setRequests(requestResponse.records);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setProducts([]);
      setRequests([]);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [branchId, getAccessToken]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    void loadProductsAndRequests();
  }, [loadProductsAndRequests]);

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        id: branch.id,
        label: [branch.code, branch.name].filter(Boolean).join(" · ") || branch.id,
      })),
    [branches],
  );

  const selectedProduct = useMemo(
    () => products.find((row) => row.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const onConfigureProduct = (product: ManagerProductSummary) => {
    setSelectedProductId(product.id);
    setVisibility(
      product.visibility === "PRIVATE" ||
        product.visibility === "PUBLIC" ||
        product.visibility === "TOP_SHELF" ||
        product.visibility === "TARGETED"
        ? product.visibility
        : "TARGETED",
    );
    setMinCustomerTier("");
    setTargetUserIds("");
    setVisibilityNote("");
  };

  const onSubmitTargeting = async () => {
    if (!branchId || !selectedProductId) {
      setError("Select branch and product before updating targeting.");
      return;
    }

    setTargetingSubmitting(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      await updateManagerProductTargeting({
        accessToken,
        productId: selectedProductId,
        branchId,
        visibility,
        minCustomerTier: minCustomerTier || undefined,
        userIds: targetUserIds
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        visibilityNote: visibilityNote || undefined,
      });

      setNotice("Product targeting updated.");
      await loadProductsAndRequests();
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setTargetingSubmitting(false);
    }
  };

  const onToggleRequestProduct = (productId: string) => {
    setRequestProductIds((current) =>
      current.includes(productId)
        ? current.filter((entry) => entry !== productId)
        : [...current, productId],
    );
  };

  const onSubmitBranchRequest = async () => {
    setError("");
    setNotice("");

    if (!branchId || requestProductIds.length === 0) {
      setError("Select at least one product before submitting a branch product request.");
      return;
    }

    const parsedRate = requestedCommissionRate.trim()
      ? Number(requestedCommissionRate)
      : undefined;

    if (parsedRate !== undefined && Number.isNaN(parsedRate)) {
      setError("Requested commission rate must be a valid number.");
      return;
    }

    setRequestSubmitting(true);

    try {
      const accessToken = await getAccessToken();
      const result = await createManagerBranchProductRequest({
        accessToken,
        branchId,
        productIds: requestProductIds,
        requestedCommissionRate: parsedRate,
        note: requestNote || undefined,
      });

      setNotice(result.message || "Branch product request submitted.");
      setRequestProductIds([]);
      setRequestedCommissionRate("");
      setRequestNote("");
      await loadProductsAndRequests();
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Targeting"
        description="Update product visibility targeting and submit branch product approval requests."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setSelectedProductId("");
                setRequestProductIds([]);
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
              onClick={() => void loadProductsAndRequests()}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Branch Products
            </h2>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">
                No products found for selected branch.
              </div>
            ) : (
              products.map((product) => (
                <div key={product.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {[product.sku, product.name].filter(Boolean).join(" · ") || product.id}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Visibility: {product.visibility || "-"} · Tier: {product.tier || "-"} · Status:{" "}
                        {product.status || "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={requestProductIds.includes(product.id)}
                          onChange={() => onToggleRequestProduct(product.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        Request
                      </label>
                      <button
                        type="button"
                        onClick={() => onConfigureProduct(product)}
                        className="px-2.5 py-1.5 text-xs font-medium border border-emerald-200 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      >
                        Configure
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Targeting Configuration
            </h3>
            {!selectedProduct ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pick a product from the list to configure targeting.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedProduct.name || selectedProduct.sku || selectedProduct.id}
                </p>
                <select
                  value={visibility}
                  onChange={(event) =>
                    setVisibility(
                      event.target.value as "PRIVATE" | "PUBLIC" | "TOP_SHELF" | "TARGETED",
                    )
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                >
                  <option value="TARGETED">TARGETED</option>
                  <option value="PRIVATE">PRIVATE</option>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="TOP_SHELF">TOP_SHELF</option>
                </select>
                <select
                  value={minCustomerTier}
                  onChange={(event) =>
                    setMinCustomerTier(event.target.value as "" | "REGULAR" | "VIP" | "ULTRA_VIP")
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                >
                  <option value="">No tier minimum</option>
                  <option value="REGULAR">REGULAR</option>
                  <option value="VIP">VIP</option>
                  <option value="ULTRA_VIP">ULTRA_VIP</option>
                </select>
                <input
                  type="text"
                  value={targetUserIds}
                  onChange={(event) => setTargetUserIds(event.target.value)}
                  placeholder="userIds CSV (optional)"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />
                <input
                  type="text"
                  value={visibilityNote}
                  onChange={(event) => setVisibilityNote(event.target.value)}
                  placeholder="Visibility note (optional)"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => void onSubmitTargeting()}
                  disabled={targetingSubmitting}
                  className="w-full py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {targetingSubmitting ? "Updating..." : "Update Targeting"}
                </button>
              </>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Branch Product Request
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Selected products: {requestProductIds.length}
            </p>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={requestedCommissionRate}
              onChange={(event) => setRequestedCommissionRate(event.target.value)}
              placeholder="Requested commission rate (optional)"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            />
            <input
              type="text"
              value={requestNote}
              onChange={(event) => setRequestNote(event.target.value)}
              placeholder="Request note (optional)"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            />
            <button
              type="button"
              onClick={() => void onSubmitBranchRequest()}
              disabled={requestSubmitting}
              className="w-full py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {requestSubmitting ? "Submitting..." : "Submit Branch Product Request"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Branch Product Requests
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                <th className="px-5 py-3 font-medium">Request</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Products</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No branch product requests for selected scope.
                  </td>
                </tr>
              ) : (
                requests.map((row) => (
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
                        {row.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.branch?.name || row.branch?.code || row.branch?.id || "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.requestedProducts.length === 0
                        ? "-"
                        : row.requestedProducts
                            .slice(0, 3)
                            .map((entry) => entry.sku || entry.name || entry.id)
                            .join(", ")}
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
