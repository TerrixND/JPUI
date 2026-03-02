"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import { getPublicMediaUrl, handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerBranchProductRequest,
  getManagerAnalyticsBranches,
  getManagerBranchProductRequests,
  getManagerProducts,
  updateManagerProductTargeting,
  type ManagerBranchProductRequestRecord,
  type ManagerProductSummary,
} from "@/lib/managerApi";

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const statusStyle = (status: string | null) => {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    case "APPROVED":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    case "REJECTED":
      return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    case "CANCELLED":
      return "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

const parseUserIds = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const getProductLabel = (product: Pick<ManagerProductSummary, "id" | "sku" | "name">) =>
  [product.sku, product.name].filter(Boolean).join(" · ") || product.id;

export default function ManagerTargeting() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [products, setProducts] = useState<ManagerProductSummary[]>([]);
  const [requests, setRequests] = useState<ManagerBranchProductRequestRecord[]>([]);
  const [targetingSubmitting, setTargetingSubmitting] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const [targetingProductId, setTargetingProductId] = useState("");
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
  const [productPreviewUrls, setProductPreviewUrls] = useState<Record<string, string>>({});

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

  const loadProductsAndRequests = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId) {
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
            branchId: resolvedBranchId,
          }),
          getManagerBranchProductRequests({
            accessToken,
            branchId: resolvedBranchId,
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
        setProducts([]);
        setRequests([]);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches]);

  useEffect(() => {
    if (branchId) {
      void loadProductsAndRequests(branchId);
    }
  }, [branchId, loadProductsAndRequests]);

  useEffect(() => {
    let cancelled = false;

    const directPreviewUrls = Object.fromEntries(
      products
        .map((product) => [product.id, product.previewImageUrl] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    );

    setProductPreviewUrls(directPreviewUrls);

    const pendingPreviewProducts = products.filter(
      (product) => !product.previewImageUrl && product.previewImageMediaId,
    );

    if (!pendingPreviewProducts.length) {
      return () => {
        cancelled = true;
      };
    }

    const resolvePreviewUrls = async () => {
      try {
        const accessToken = await getAccessToken();
        const resolvedEntries = await Promise.all(
          pendingPreviewProducts.map(async (product) => {
            if (!product.previewImageMediaId) {
              return null;
            }

            try {
              const media = await getPublicMediaUrl(product.previewImageMediaId, "PRIVATE", {
                accessToken,
              });

              return media.url ? ([product.id, media.url] as const) : null;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) {
          return;
        }

        const resolvedPreviewUrls = Object.fromEntries(
          resolvedEntries.filter(
            (entry): entry is readonly [string, string] => Boolean(entry),
          ),
        );

        setProductPreviewUrls({
          ...directPreviewUrls,
          ...resolvedPreviewUrls,
        });
      } catch {
        if (!cancelled) {
          setProductPreviewUrls(directPreviewUrls);
        }
      }
    };

    void resolvePreviewUrls();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, products]);

  const selectedTargetingProduct = useMemo(
    () => products.find((row) => row.id === targetingProductId) || null,
    [products, targetingProductId],
  );

  const onSubmitTargeting = async () => {
    if (!branchId || !targetingProductId.trim()) {
      setError("Branch and product ID are required before updating targeting.");
      return;
    }

    setTargetingSubmitting(true);
    setError("");
    setNotice("");

    const userIds = parseUserIds(targetUserIds);

    try {
      const accessToken = await getAccessToken();
      await updateManagerProductTargeting({
        accessToken,
        productId: targetingProductId.trim(),
        branchId,
        visibility,
        minCustomerTier: minCustomerTier || undefined,
        userIds,
        visibilityNote: visibilityNote || undefined,
      });

      setNotice("Product targeting updated.");
      await loadProductsAndRequests(branchId);
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

    if (parsedRate !== undefined && (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100)) {
      setError("Requested commission rate must be a number between 0 and 100.");
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
      await loadProductsAndRequests(branchId);
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
        title="Products & Targeting"
        description="Request products for your branch and manage visibility targeting."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setTargetingProductId("");
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
              onClick={() => {
                void loadBranches();
                void loadProductsAndRequests(branchId);
              }}
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-5">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Private Products Available For Branch Request
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Products available for branch selection requests.
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">
                No private products returned for the selected branch scope.
              </div>
            ) : (
              products.map((product) => {
                const requestDisabled = product.isSelectedForBranch;
                const previewUrl = productPreviewUrls[product.id] || "";
                return (
                  <div key={product.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start gap-4">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-[11px] text-gray-400 dark:border-gray-700/60 dark:bg-gray-800/50 dark:text-gray-500">
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewUrl}
                            alt={`${getProductLabel(product)} preview`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span>No preview</span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {getProductLabel(product)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Visibility: {product.visibility || "-"} · Tier: {product.tier || "-"} ·
                            Status: {product.status || "-"}
                          </p>
                          {(product.saleRangeMin !== null || product.saleRangeMax !== null) && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Sale range: {product.saleRangeMin ?? "-"} - {product.saleRangeMax ?? "-"}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-gray-600 dark:text-gray-300">
                          {product.isSelectedForBranch ? "Already active in branch" : "Requestable"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={requestProductIds.includes(product.id)}
                          disabled={requestDisabled}
                          onChange={() => onToggleRequestProduct(product.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        Add to branch request
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetingProductId(product.id);
                          setVisibility(
                            product.visibility === "PRIVATE" ||
                              product.visibility === "PUBLIC" ||
                              product.visibility === "TOP_SHELF" ||
                              product.visibility === "TARGETED"
                              ? product.visibility
                              : "TARGETED",
                          );
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium border border-emerald-200 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      >
                        Use As Targeting Input
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Visibility & Targeting Update
            </h3>
            <input
              type="text"
              value={targetingProductId}
              onChange={(event) => setTargetingProductId(event.target.value)}
              placeholder="Product ID held by this branch"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            />
            {selectedTargetingProduct && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Quick-picked product:{" "}
                {getProductLabel(selectedTargetingProduct)}
              </p>
            )}
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
            <textarea
              value={targetUserIds}
              onChange={(event) => setTargetUserIds(event.target.value)}
              placeholder="Customer user IDs, separated by commas or new lines"
              rows={4}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg resize-none"
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
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Branch Product Request
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Selected private products: {requestProductIds.length}
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
                    No branch product requests for the selected branch scope.
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
                            .slice(0, 4)
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
