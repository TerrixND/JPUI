"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerBranchProductRequest,
  getManagerAnalyticsBranches,
  getManagerProducts,
  type ManagerProductSummary,
} from "@/lib/managerApi";
import {
  formatManagerDateTime,
  getManagerProductLabel,
  managerMoney,
  managerStatusBadge,
} from "@/lib/managerDashboardUi";

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

export default function ManagerProductDetailPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const productId = String(params.productId || "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [product, setProduct] = useState<ManagerProductSummary | null>(null);
  const [requestedCommissionRate, setRequestedCommissionRate] = useState("");

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

  const loadProduct = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId || !productId) {
        setProduct(null);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const response = await getManagerProducts({
          accessToken,
          branchId: resolvedBranchId,
        });
        setProduct(response.products.find((entry) => entry.id === productId) || null);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setProduct(null);
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [branchId, getAccessToken, productId],
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const firstBranchId = await loadBranches();
        await loadProduct(firstBranchId);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setBranchOptions([]);
        setProduct(null);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches, loadProduct]);

  useEffect(() => {
    if (branchId) {
      void loadProduct(branchId);
    }
  }, [branchId, loadProduct]);

  const details = useMemo(
    () => (product?.raw && typeof product.raw === "object" ? product.raw : null),
    [product],
  );

  const requestProduct = async () => {
    if (!product || !branchId) {
      return;
    }

    const parsedRate = requestedCommissionRate.trim()
      ? Number(requestedCommissionRate)
      : undefined;
    if (
      parsedRate !== undefined &&
      (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100)
    ) {
      setError("Requested commission rate must be between 0 and 100.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await createManagerBranchProductRequest({
        accessToken,
        branchId,
        productIds: [product.id],
        requestedCommissionRate: parsedRate,
      });
      setNotice(response.message || "Product request submitted.");
      await loadProduct(branchId);
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
        title={product ? getManagerProductLabel(product) : "Product Detail"}
        description="Product media and detail page for request review before sending to main admin."
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
            <Link
              href={`${dashboardBasePath}/products`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Products
            </Link>
          </div>
        }
      />

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-96 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900" />
          <div className="h-96 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900" />
        </div>
      ) : !product ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
          This product was not found for the selected branch scope.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${managerStatusBadge(product.status)}`}
              >
                {product.status || "UNKNOWN"}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {product.visibility || "-"}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {product.media.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-gray-300 px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                  No media returned for this product.
                </div>
              ) : (
                product.media.map((media) => {
                  const previewUrl = media.url || media.originalUrl || "";
                  return (
                    <div
                      key={media.id || `${media.slot || media.type}-${media.displayOrder ?? 0}`}
                      className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700/60"
                    >
                      <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800/40">
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewUrl}
                            alt={media.slot || media.type || "Product media"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                            {media.type || "Media"}
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {media.slot || media.type || media.id || "Media"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Visibility preset: {media.visibilityPreset || "-"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Product Snapshot
              </h2>
              <div className="mt-3 grid gap-3">
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Tier
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {product.tier || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Sale Range
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {product.saleRangeMin !== null ? managerMoney.format(product.saleRangeMin) : "-"}
                    {" to "}
                    {product.saleRangeMax !== null ? managerMoney.format(product.saleRangeMax) : "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Last Updated
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatManagerDateTime(details?.updatedAt as string | null)}
                  </p>
                </div>
              </div>
            </section>

            {!product.isSelectedForBranch ? (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Request This Product
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {product.branchRequestState?.canRequest === false
                    ? `Blocked: ${product.branchRequestState.blockReason || "Unavailable"}`
                    : "Send this product to main admin for branch approval."}
                </p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={requestedCommissionRate}
                  onChange={(event) => setRequestedCommissionRate(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                  placeholder="Requested commission rate"
                />
                <button
                  type="button"
                  onClick={() => {
                    void requestProduct();
                  }}
                  disabled={submitting || product.branchRequestState?.canRequest === false}
                  className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Request Product"}
                </button>
              </section>
            ) : (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                This product is already approved in branch inventory.
                {" "}
                <Link
                  href={`${dashboardBasePath}/inventory/${product.id}/targeting`}
                  className="font-semibold underline"
                >
                  Open inventory controls
                </Link>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
