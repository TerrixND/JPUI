"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { getAdminMediaUrl } from "@/lib/apiClient";
import { getAdminActionRestrictionTooltip } from "@/lib/adminAccessControl";

type ApiErrorPayload = {
  message?: string;
  code?: string;
  reason?: string;
};

type InventoryAnalyticsResponse = {
  includeSold: boolean;
  totals: {
    productCount: number;
    pricedProductCount: number;
    unpricedProductCount: number;
    projectedRevenueMin: number;
    projectedRevenueMax: number;
    projectedNetProfitMin: number;
    projectedNetProfitMax: number;
  };
  inventory: InventoryProduct[];
};

type InventoryProduct = {
  id: string;
  sku: string;
  name: string | null;
  status: string;
  pricing: {
    buyPrice: number | null;
    saleMinPrice: number | null;
    saleMaxPrice: number | null;
    isComplete: boolean;
  };
  commission: {
    allocationRateTotal: number;
    allocations: Array<{
      id: string;
      targetType: "BRANCH" | "USER";
    }>;
  };
  estimate: {
    netProfitMin: number | null;
    netProfitMax: number | null;
  };
};

type AdminProductMediaRef = {
  id?: string | null;
  type?: string | null;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

type AdminProductListItem = {
  id: string;
  media?: AdminProductMediaRef[] | null;
};

type AdminProductsListResponse = {
  includeSold?: boolean;
  count?: number;
  items?: AdminProductListItem[] | null;
};

type ProductImageRef = {
  mediaId: string | null;
  url: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const toErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  const message = payload?.message || fallback;
  const code = payload?.code ? ` (code: ${payload.code})` : "";
  const reason = payload?.reason ? ` (reason: ${payload.reason})` : "";
  return `${message}${code}${reason}`;
};

const toMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return money.format(value);
};

const moneyRange = (min: number | null | undefined, max: number | null | undefined) => {
  if (min === null || min === undefined || max === null || max === undefined) {
    return "-";
  }

  return `${money.format(min)} - ${money.format(max)}`;
};

const statusBadge = (status: string) => {
  switch (status) {
    case "AVAILABLE":
      return "bg-green-50 text-green-700";
    case "PENDING":
      return "bg-amber-50 text-amber-700";
    case "BUSY":
      return "bg-blue-50 text-blue-700";
    case "SOLD":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const normalizeMediaType = (value: unknown) => String(value || "").trim().toUpperCase();

const hasMediaReference = (product: AdminProductListItem) =>
  (Array.isArray(product.media) ? product.media : []).some((mediaRef) => {
    const mediaId = typeof mediaRef?.id === "string" ? mediaRef.id.trim() : "";
    const mediaUrl = typeof mediaRef?.url === "string" ? mediaRef.url.trim() : "";
    return Boolean(mediaId || mediaUrl);
  });

const toProductImageRef = (product: AdminProductListItem): ProductImageRef | null => {
  const mediaRows = Array.isArray(product.media) ? product.media : [];

  for (const mediaRef of mediaRows) {
    const mediaUrl = typeof mediaRef?.url === "string" ? mediaRef.url.trim() : "";
    if (!mediaUrl) {
      continue;
    }

    const mediaType = normalizeMediaType(mediaRef?.type);
    const mimeType = typeof mediaRef?.mimeType === "string" ? mediaRef.mimeType.trim().toLowerCase() : "";
    const isImage = mediaType === "IMAGE" || mimeType.startsWith("image/");

    if (!isImage) {
      continue;
    }

    const mediaId = typeof mediaRef?.id === "string" && mediaRef.id.trim() ? mediaRef.id.trim() : null;
    return {
      mediaId,
      url: mediaUrl,
    };
  }

  return null;
};

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/* ────────────── icons ────────────── */
function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}
function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}
function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A2 2 0 003.38 22h17.24a2 2 0 001.7-3.28l-8.6-14.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}
function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function EmptyBoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

export default function AdminProducts() {
  const { dashboardBasePath, isAdminActionBlocked } = useRole();
  const productCreateBlocked = isAdminActionBlocked("PRODUCT_CREATE");
  const productEditBlocked = isAdminActionBlocked("PRODUCT_EDIT");
  const productDeleteBlocked = isAdminActionBlocked("PRODUCT_DELETE");
  const productCreateTooltip = getAdminActionRestrictionTooltip("PRODUCT_CREATE");
  const productEditTooltip = getAdminActionRestrictionTooltip("PRODUCT_EDIT");
  const productDeleteTooltip = getAdminActionRestrictionTooltip("PRODUCT_DELETE");

  const [includeSold, setIncludeSold] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaHint, setMediaHint] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<InventoryAnalyticsResponse | null>(null);
  const [mediaByProductId, setMediaByProductId] = useState<Record<string, ProductImageRef>>({});
  const refreshingProductIdsRef = useRef<Set<string>>(new Set());

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

  const fetchAdminMediaById = useCallback(
    async (accessToken: string, mediaId: string) => {
      try {
        const media = await getAdminMediaUrl({
          mediaId,
          accessToken,
        });

        if (String(media.type || "").trim().toUpperCase() !== "IMAGE") {
          return null;
        }

        return {
          mediaId: media.id,
          url: media.url,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const refreshProductImage = useCallback(
    async (productId: string, mediaId: string) => {
      if (!productId || !mediaId) {
        return;
      }

      if (refreshingProductIdsRef.current.has(productId)) {
        return;
      }

      refreshingProductIdsRef.current.add(productId);

      try {
        const accessToken = await getAccessToken();
        const refreshedMedia = await fetchAdminMediaById(accessToken, mediaId);

        if (!refreshedMedia) {
          return;
        }

        setMediaByProductId((prev) => {
          const current = prev[productId];
          if (!current || current.mediaId !== mediaId) {
            return prev;
          }

          return {
            ...prev,
            [productId]: refreshedMedia,
          };
        });
      } catch {
        // Keep stale URL if refresh fails; a future retry/interval can recover.
      } finally {
        refreshingProductIdsRef.current.delete(productId);
      }
    },
    [fetchAdminMediaById, getAccessToken],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setMediaHint("");

    try {
      const accessToken = await getAccessToken();
      const query = includeSold ? "?includeSold=true" : "";

      const [analyticsResponse, productsResponse] = await Promise.all([
        fetch(`/api/v1/admin/analytics/inventory-profit${query}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }),
        fetch(`/api/v1/admin/products${query}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }),
      ]);

      const [analyticsPayload, productsPayload] = await Promise.all([
        analyticsResponse.json().catch(() => null),
        productsResponse.json().catch(() => null),
      ]);

      if (!analyticsResponse.ok) {
        throw new Error(
          toErrorMessage(analyticsPayload as ApiErrorPayload | null, "Failed to load product analytics."),
        );
      }

      if (!productsResponse.ok) {
        throw new Error(
          toErrorMessage(productsPayload as ApiErrorPayload | null, "Failed to load admin products."),
        );
      }

      const analyticsData = analyticsPayload as InventoryAnalyticsResponse;
      const productRows = Array.isArray((productsPayload as AdminProductsListResponse)?.items)
        ? ((productsPayload as AdminProductsListResponse).items as AdminProductListItem[])
        : [];

      const hasMediaReferences = productRows.some(hasMediaReference);

      const mediaMap: Record<string, ProductImageRef> = {};
      for (const product of productRows) {
        const resolvedImage = toProductImageRef(product);
        if (resolvedImage) {
          mediaMap[product.id] = resolvedImage;
        }
      }

      setMediaByProductId(mediaMap);
      setAnalytics(analyticsData);

      if (productRows.length > 0) {
        if (!hasMediaReferences) {
          setMediaHint(
            "Media previews are unavailable because the admin products response does not include media references for these products.",
          );
        } else if (Object.keys(mediaMap).length === 0) {
          setMediaHint("Media references were found, but no image previews could be resolved.");
        }
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load products.";

      setError(message);
      setMediaHint("");
      setAnalytics(null);
      setMediaByProductId({});
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, includeSold]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const rows = Object.entries(mediaByProductId);

    if (rows.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      for (const [productId, media] of rows) {
        if (media.mediaId) {
          void refreshProductImage(productId, media.mediaId);
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [mediaByProductId, refreshProductImage]);

  const totalProducts = useMemo(() => analytics?.totals.productCount || 0, [analytics]);

  const handleDeleteProduct = useCallback(
    async (product: InventoryProduct) => {
      if (productDeleteBlocked) {
        setError(productDeleteTooltip);
        return;
      }

      const label = product.name || product.sku || product.id;
      const confirmed = window.confirm(`Delete product "${label}"? This will archive the product.`);
      if (!confirmed) {
        return;
      }

      const reasonInput = window.prompt("Optional delete reason:", "");
      const reason = String(reasonInput || "").trim();

      setError("");
      setDeletingProductId(product.id);

      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`/api/v1/admin/products/${encodeURIComponent(product.id)}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(reason ? { reason } : {}),
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
        if (!response.ok) {
          throw new Error(toErrorMessage(payload, "Failed to delete product."));
        }

        await loadData();
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to delete product.";
        setError(message);
      } finally {
        setDeletingProductId(null);
      }
    },
    [getAccessToken, loadData, productDeleteBlocked, productDeleteTooltip],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Real-time pricing, allocations, projected profit, and media preview."
        action={
          productCreateBlocked ? (
            <span
              title={productCreateTooltip}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-300 text-gray-600 text-sm font-medium rounded-lg cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Product
            </span>
          ) : (
            <Link
              href={`${dashboardBasePath}/products/add`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Product
            </Link>
          )
        }
      />

      {(productCreateBlocked || productEditBlocked || productDeleteBlocked) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some product write actions are currently restricted.
        </div>
      )}

      {/* ───── toggle tabs ───── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIncludeSold(false)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !includeSold
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Active Inventory
        </button>
        <button
          type="button"
          onClick={() => setIncludeSold(true)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            includeSold
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Include Sold
        </button>
      </div>

      {/* ───── loading skeleton ───── */}
      {loading && (
        <div className="space-y-4">
          {/* stat skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                <div className="h-6 w-28 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
          {/* table skeleton */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 border-b border-gray-50">
                <div className="w-12 h-12 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="hidden sm:flex items-center gap-6">
                  <div className="h-5 w-16 rounded-full bg-gray-100 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───── error state ───── */}
      {!loading && error && (
        <div className="flex items-start gap-3 px-4 py-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load products</p>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="shrink-0 px-3.5 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && analytics && (
        <>
          {/* media hint */}
          {mediaHint && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-700">{mediaHint}</p>
            </div>
          )}

          {/* ───── stat cards ───── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="shrink-0 p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <PackageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Products</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{analytics.totals.productCount}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600">
                <TagIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Priced / Unpriced</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">
                  {analytics.totals.pricedProductCount} / {analytics.totals.unpricedProductCount}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="shrink-0 p-2 rounded-lg bg-purple-50 text-purple-600">
                <TrendingUpIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Proj. Revenue</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">
                  {moneyRange(analytics.totals.projectedRevenueMin, analytics.totals.projectedRevenueMax)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="shrink-0 p-2 rounded-lg bg-amber-50 text-amber-600">
                <DollarIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Proj. Net Profit</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">
                  {moneyRange(analytics.totals.projectedNetProfitMin, analytics.totals.projectedNetProfitMax)}
                </p>
              </div>
            </div>
          </div>

          {/* ───── product table (desktop) ───── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Inventory</h2>
              <p className="text-xs text-gray-500">{analytics.inventory.length} product(s)</p>
            </div>

            {/* empty state */}
            {totalProducts === 0 && (
              <div className="px-5 py-16 flex flex-col items-center gap-3">
                <EmptyBoxIcon className="w-10 h-10 text-gray-300" />
                <p className="text-sm text-gray-500">No products found.</p>
                {productCreateBlocked ? (
                  <span title={productCreateTooltip} className="text-sm text-gray-400 font-medium cursor-not-allowed">
                    Add your first product
                  </span>
                ) : (
                  <Link
                    href={`${dashboardBasePath}/products/add`}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Add your first product
                  </Link>
                )}
              </div>
            )}

            {/* desktop table */}
            {totalProducts > 0 && (
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                      <th className="px-5 py-3 font-medium">Product</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Buy Price</th>
                      <th className="px-5 py-3 font-medium">Sale Range</th>
                      <th className="px-5 py-3 font-medium">Allocation Rate</th>
                      <th className="px-5 py-3 font-medium">Net Profit Range</th>
                      <th className="px-5 py-3 font-medium">Rows</th>
                      <th className="px-5 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.inventory.map((item) => {
                      const productImage = mediaByProductId[item.id];
                      const productImageUrl = productImage?.url || "";

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                        >
                          <td className="px-5 py-3">
                            <Link href={`${dashboardBasePath}/products/${item.id}`} className="group">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center shrink-0">
                                  {productImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={productImageUrl}
                                      alt={item.name || item.sku}
                                      className="w-full h-full object-cover"
                                      onError={() => {
                                        if (productImage?.mediaId) {
                                          void refreshProductImage(item.id, productImage.mediaId);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <ImagePlaceholderIcon className="w-5 h-5 text-gray-300" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
                                    {item.name || "Unnamed Product"}
                                  </p>
                                  <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusBadge(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-700">{toMoney(item.pricing.buyPrice)}</td>
                          <td className="px-5 py-3 text-gray-700">
                            {moneyRange(item.pricing.saleMinPrice, item.pricing.saleMaxPrice)}
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {Number(item.commission.allocationRateTotal || 0).toFixed(2)}%
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {moneyRange(item.estimate.netProfitMin, item.estimate.netProfitMax)}
                          </td>
                          <td className="px-5 py-3 text-gray-500">{item.commission.allocations.length}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {productEditBlocked ? (
                                <span
                                  title={productEditTooltip}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-400 cursor-not-allowed"
                                >
                                  Edit
                                </span>
                              ) : (
                                <Link
                                  href={`${dashboardBasePath}/products/${item.id}`}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  Edit
                                </Link>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteProduct(item);
                                }}
                                disabled={productDeleteBlocked || deletingProductId === item.id}
                                title={productDeleteBlocked ? productDeleteTooltip : undefined}
                                className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                              >
                                {deletingProductId === item.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* mobile / tablet card view */}
            {totalProducts > 0 && (
              <div className="lg:hidden divide-y divide-gray-100">
                {analytics.inventory.map((item) => {
                  const productImage = mediaByProductId[item.id];
                  const productImageUrl = productImage?.url || "";

                  return (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        {/* image */}
                        <Link
                          href={`${dashboardBasePath}/products/${item.id}`}
                          className="shrink-0"
                        >
                          <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                            {productImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={productImageUrl}
                                alt={item.name || item.sku}
                                className="w-full h-full object-cover"
                                onError={() => {
                                  if (productImage?.mediaId) {
                                    void refreshProductImage(item.id, productImage.mediaId);
                                  }
                                }}
                              />
                            ) : (
                              <ImagePlaceholderIcon className="w-6 h-6 text-gray-300" />
                            )}
                          </div>
                        </Link>

                        {/* info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`${dashboardBasePath}/products/${item.id}`} className="min-w-0">
                              <p className="font-medium text-gray-900 truncate hover:text-emerald-700 transition-colors">
                                {item.name || "Unnamed Product"}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                            </Link>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusBadge(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </div>

                          {/* details grid */}
                          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <div>
                              <span className="text-gray-400">Buy:</span>{" "}
                              <span className="text-gray-700 font-medium">{toMoney(item.pricing.buyPrice)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Sale:</span>{" "}
                              <span className="text-gray-700 font-medium">
                                {moneyRange(item.pricing.saleMinPrice, item.pricing.saleMaxPrice)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400">Alloc:</span>{" "}
                              <span className="text-gray-700 font-medium">
                                {Number(item.commission.allocationRateTotal || 0).toFixed(2)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400">Profit:</span>{" "}
                              <span className="text-gray-700 font-medium">
                                {moneyRange(item.estimate.netProfitMin, item.estimate.netProfitMax)}
                              </span>
                            </div>
                          </div>

                          {/* actions */}
                          <div className="mt-3 flex items-center gap-2">
                            {productEditBlocked ? (
                              <span
                                title={productEditTooltip}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-400 cursor-not-allowed"
                              >
                                Edit
                              </span>
                            ) : (
                              <Link
                                href={`${dashboardBasePath}/products/${item.id}`}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                Edit
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                void handleDeleteProduct(item);
                              }}
                              disabled={productDeleteBlocked || deletingProductId === item.id}
                              title={productDeleteBlocked ? productDeleteTooltip : undefined}
                              className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            >
                              {deletingProductId === item.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
