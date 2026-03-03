"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getManagerAnalyticsBranches,
  getManagerProducts,
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

export default function ManagerInventoryPage() {
  const { dashboardBasePath } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [products, setProducts] = useState<ManagerProductSummary[]>([]);

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
        setProducts(response.products);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setProducts([]);
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

  const selectedProducts = useMemo(
    () => products.filter((product) => product.isSelectedForBranch),
    [products],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Branch-approved inventory products. Open each product to manage targeting visibility and salesperson commissions."
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

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900"
            />
          ))}
        </div>
      ) : selectedProducts.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
          No approved branch inventory products found for the selected branch.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedProducts.map((product) => {
            const previewUrl = getManagerProductPreviewUrl(product);

            return (
              <div
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

                <div className="space-y-4 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {getManagerProductLabel(product)}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${managerStatusBadge(product.status)}`}
                      >
                        {product.status || "UNKNOWN"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Visibility: {product.visibility || "-"} · Commission:{" "}
                      {product.branchCommissionRate ?? 0}%
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Last updated {formatManagerDateTime(product.raw.updatedAt as string | null)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800/40">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                        Sale Min
                      </p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                        {product.saleRangeMin ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800/40">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                        Sale Max
                      </p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                        {product.saleRangeMax ?? "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Link
                      href={`${dashboardBasePath}/inventory/${product.id}/targeting`}
                      className="rounded-xl bg-amber-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                    >
                      Targeting & Visibility
                    </Link>
                    <Link
                      href={`${dashboardBasePath}/inventory/${product.id}/commissions`}
                      className="rounded-xl bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                    >
                      Commission Policy
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
