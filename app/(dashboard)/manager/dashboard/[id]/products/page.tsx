"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerBranchProductRequest,
  getManagerAnalyticsBranches,
  getManagerBranchProductRequests,
  getManagerProducts,
  type ManagerBranchProductRequestRecord,
  type ManagerProductSummary,
} from "@/lib/managerApi";
import {
  formatManagerDateTime,
  getManagerProductLabel,
  getManagerProductPreviewUrl,
  managerStatusBadge,
} from "@/lib/managerDashboardUi";

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const requestStatusBadge = (status: string | null | undefined) =>
  managerStatusBadge(status);

export default function ManagerProductsPage() {
  const { dashboardBasePath } = useRole();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [products, setProducts] = useState<ManagerProductSummary[]>([]);
  const [requests, setRequests] = useState<ManagerBranchProductRequestRecord[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
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

  const loadBranchOptions = useCallback(async () => {
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

  const loadProducts = useCallback(
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
            limit: 30,
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
        const firstBranchId = await loadBranchOptions();
        await loadProducts(firstBranchId);
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
  }, [loadBranchOptions, loadProducts]);

  useEffect(() => {
    if (branchId) {
      void loadProducts(branchId);
    }
  }, [branchId, loadProducts]);

  const requestableProducts = useMemo(
    () => products.filter((product) => !product.isSelectedForBranch),
    [products],
  );

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((entry) => entry !== productId)
        : [...current, productId],
    );
  };

  const submitRequest = async () => {
    setError("");
    setNotice("");

    if (!branchId || selectedProductIds.length === 0) {
      setError("Select at least one product before submitting a request.");
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

    try {
      const accessToken = await getAccessToken();
      const response = await createManagerBranchProductRequest({
        accessToken,
        branchId,
        productIds: selectedProductIds,
        requestedCommissionRate: parsedRate,
        note: requestNote || undefined,
      });

      setNotice(response.message || "Branch product request submitted.");
      setSelectedProductIds([]);
      setRequestedCommissionRate("");
      setRequestNote("");
      await loadProducts(branchId);
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
        title="Products"
        description="Request non-private products into branch inventory. Approved products disappear from this page and move into Inventory."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setSelectedProductIds([]);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-900"
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
                void loadBranchOptions();
                void loadProducts(branchId);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Refresh
            </button>
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

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
                />
              ))
            ) : requestableProducts.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                No requestable products remain for this branch.
              </div>
            ) : (
              requestableProducts.map((product) => {
                const previewUrl = getManagerProductPreviewUrl(product);
                const requestState = product.branchRequestState;
                const disabled = requestState?.canRequest === false;

                return (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900"
                  >
                    <div className="aspect-[4/3] border-b border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40">
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt={`${getManagerProductLabel(product)} preview`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                          No preview
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {getManagerProductLabel(product)}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${managerStatusBadge(product.status)}`}
                        >
                          {product.status || "UNKNOWN"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Visibility: {product.visibility || "-"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Updated {formatManagerDateTime(product.raw.updatedAt as string | null)}
                      </p>

                      {requestState ? (
                        <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
                          <p>
                            Requests: {requestState.totalRequests} total · {requestState.rejectedCount} rejected
                          </p>
                          <p>
                            Remaining retries: {requestState.remainingRetries} / {requestState.retryLimit}
                          </p>
                          {requestState.cooldownActive ? (
                            <p className="mt-1 text-amber-700 dark:text-amber-300">
                              Cooldown active until {formatManagerDateTime(requestState.cooldownEndsAt)}
                            </p>
                          ) : null}
                          {!requestState.canRequest ? (
                            <p className="mt-1 text-red-600 dark:text-red-300">
                              Blocked: {requestState.blockReason || "Unavailable"}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => toggleProduct(product.id)}
                            disabled={disabled}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Select
                        </label>
                        <Link
                          href={`${dashboardBasePath}/products/${product.id}/detail`}
                          className="text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                        >
                          View Detail
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700/60 dark:bg-gray-800/40">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Submit Product Request
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Rejected requests can be re-requested up to the server-defined retry limit. Active cooldowns block submission until expiry or admin resolution.
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-white px-4 py-3 text-sm dark:bg-gray-900">
                Selected products:{" "}
                <span className="font-semibold">{selectedProductIds.length}</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={requestedCommissionRate}
                onChange={(event) => setRequestedCommissionRate(event.target.value)}
                placeholder="Requested commission rate"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
              <textarea
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                rows={4}
                placeholder="Request note"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={() => {
                  void submitRequest();
                }}
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Send to Main Admin"}
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Product Request History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70 text-left text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-400">
                <th className="px-5 py-3 font-medium">Request</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Products</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No product requests found for this branch.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {request.id}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${requestStatusBadge(request.status)}`}
                      >
                        {request.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {request.requestedProducts.length
                        ? request.requestedProducts
                            .map((product) => product.name || product.sku || product.id)
                            .join(", ")
                        : "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {formatManagerDateTime(request.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
