"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getManagerAnalyticsBranches,
  getManagerCommissionPolicies,
  getManagerProducts,
  type ManagerCommissionPolicyRecord,
  type ManagerProductSummary,
} from "@/lib/managerApi";
import {
  formatManagerDateTime,
  getManagerProductLabel,
  getManagerProductPreviewUrl,
  getManagerUserLabel,
} from "@/lib/managerDashboardUi";
import supabase from "@/lib/supabase";

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

type ProductCommissionRow = {
  id: string;
  productId: string;
  productLabel: string;
  previewUrl: string;
  salespersonLabel: string;
  rateLabel: string;
  branchLabel: string;
  activeFrom: string | null;
  activeTo: string | null;
  note: string | null;
  statusLabel: "ACTIVE" | "SCHEDULED" | "ENDED" | "INACTIVE";
  updatedAt: string | null;
};

const getCommissionStatusLabel = (
  policy: Pick<ManagerCommissionPolicyRecord, "isActive" | "activeFrom" | "activeTo">,
) => {
  if (policy.isActive === false) {
    return "INACTIVE" as const;
  }

  const now = Date.now();
  const startsAt = policy.activeFrom ? new Date(policy.activeFrom).getTime() : null;
  const endsAt = policy.activeTo ? new Date(policy.activeTo).getTime() : null;

  if (startsAt !== null && Number.isFinite(startsAt) && startsAt > now) {
    return "SCHEDULED" as const;
  }

  if (endsAt !== null && Number.isFinite(endsAt) && endsAt < now) {
    return "ENDED" as const;
  }

  return "ACTIVE" as const;
};

const commissionStatusBadge = (status: ProductCommissionRow["statusLabel"]) => {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (status === "SCHEDULED") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (status === "ENDED") {
    return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
};

const getBranchLabel = (
  branchId: string | null,
  branchLabelById: Map<string, string>,
) => {
  if (!branchId) {
    return "-";
  }
  return branchLabelById.get(branchId) || branchId;
};

const getProductLabelForPolicy = (
  policy: Pick<ManagerCommissionPolicyRecord, "productId" | "product">,
  productById: Map<string, ManagerProductSummary>,
) => {
  const productId = policy.productId || policy.product?.id || "";
  const product = (productId ? productById.get(productId) : null) || null;

  if (product) {
    return getManagerProductLabel(product);
  }

  if (policy.product?.id) {
    return getManagerProductLabel({
      id: policy.product.id,
      sku: policy.product.sku,
      name: policy.product.name,
    });
  }

  return productId || "Unknown product";
};

const getPolicyPreviewUrl = (
  policy: Pick<ManagerCommissionPolicyRecord, "productId">,
  productById: Map<string, ManagerProductSummary>,
) => {
  const product = policy.productId ? productById.get(policy.productId) : null;
  return product ? getManagerProductPreviewUrl(product) : "";
};

export default function ManagerCommissionsPage() {
  const { dashboardBasePath } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [policies, setPolicies] = useState<ManagerCommissionPolicyRecord[]>([]);
  const [products, setProducts] = useState<ManagerProductSummary[]>([]);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const accessToken = session?.access_token || "";
    if (!accessToken) {
      throw new Error("Missing access token. Please sign in again.");
    }

    return accessToken;
  }, []);

  const loadBranches = useCallback(async () => {
    const accessToken = await getAccessToken();
    const analytics = await getManagerAnalyticsBranches({ accessToken });
    const options = analytics.branches
      .map((entry) => entry.branch)
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
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
        setPolicies([]);
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const [policyResponse, productResponse] = await Promise.all([
          getManagerCommissionPolicies({
            accessToken,
            branchId: resolvedBranchId,
            limit: 250,
          }),
          getManagerProducts({
            accessToken,
            branchId: resolvedBranchId,
          }),
        ]);

        setPolicies(policyResponse.records.filter((entry) => Boolean(entry.productId)));
        setProducts(productResponse.products);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        setPolicies([]);
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
        await loadBranches();
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        setBranchOptions([]);
        setPolicies([]);
        setProducts([]);
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

  const branchLabelById = useMemo(
    () => new Map(branchOptions.map((entry) => [entry.id, entry.label])),
    [branchOptions],
  );

  const productById = useMemo(
    () => new Map(products.map((entry) => [entry.id, entry])),
    [products],
  );

  const rows = useMemo<ProductCommissionRow[]>(
    () =>
      [...policies]
        .sort((left, right) => {
          const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
          const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
          return rightTime - leftTime;
        })
        .map((policy) => ({
          id: policy.id,
          productId: policy.productId || "",
          productLabel: getProductLabelForPolicy(policy, productById),
          previewUrl: getPolicyPreviewUrl(policy, productById),
          salespersonLabel: policy.salesperson
            ? getManagerUserLabel({
                displayName: policy.salesperson.displayName,
                email: policy.salesperson.user?.email || null,
                userId: policy.salesperson.user?.id || policy.salesperson.id,
              })
            : policy.salespersonUserId || policy.salespersonId || "-",
          rateLabel: typeof policy.rate === "number" ? `${policy.rate}%` : "-",
          branchLabel: getBranchLabel(policy.branchId, branchLabelById),
          activeFrom: policy.activeFrom,
          activeTo: policy.activeTo,
          note: policy.note,
          statusLabel: getCommissionStatusLabel(policy),
          updatedAt: policy.updatedAt,
        })),
    [branchLabelById, policies, productById],
  );

  const summary = useMemo(() => {
    const activeCount = rows.filter((entry) => entry.statusLabel === "ACTIVE").length;
    const uniqueProducts = new Set(rows.map((entry) => entry.productId)).size;
    const rateValues = policies
      .map((entry) => entry.rate)
      .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));

    return {
      totalPolicies: rows.length,
      activeCount,
      uniqueProducts,
      averageRate:
        rateValues.length > 0
          ? `${(rateValues.reduce((sum, value) => sum + value, 0) / rateValues.length).toFixed(1)}%`
          : "-",
    };
  }, [policies, rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions"
        description="Review all product commission policies configured from inventory product commission controls."
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
                void loadBranches();
                void loadBranchContext(branchId);
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Product Policies
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.totalPolicies}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Active Now
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Products Covered
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.uniqueProducts}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Average Rate
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {summary.averageRate}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Inventory Product Policies
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Default and tier-wide rules are excluded here. This page only mirrors policies owned
              by each inventory product commission control.
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Approved inventory products:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {products.length}
            </span>
          </p>
        </div>

        {loading ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-sm text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
            No product commission policies found for this branch.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700/60"
              >
                <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40">
                    {row.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.previewUrl}
                        alt={`${row.productLabel} preview`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                        No preview
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {row.productLabel}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${commissionStatusBadge(
                          row.statusLabel,
                        )}`}
                      >
                        {row.statusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-700/60 dark:bg-gray-800/40">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Salesperson
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-200">
                          {row.salespersonLabel}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-700/60 dark:bg-gray-800/40">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Commission Rate
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-200">{row.rateLabel}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-700/60 dark:bg-gray-800/40">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Branch
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-200">{row.branchLabel}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-700/60 dark:bg-gray-800/40">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                          Active Window
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-200">
                          {formatManagerDateTime(row.activeFrom)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          to {formatManagerDateTime(row.activeTo)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Policy updated {formatManagerDateTime(row.updatedAt)}
                        </p>
                        {row.note ? (
                          <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                            {row.note}
                          </p>
                        ) : null}
                      </div>

                      <Link
                        href={`${dashboardBasePath}/inventory/${row.productId}/commissions`}
                        className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                      >
                        Edit Policy
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
