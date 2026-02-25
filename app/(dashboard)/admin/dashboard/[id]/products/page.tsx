"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { getAdminMediaUrl } from "@/lib/apiClient";

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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function AdminProducts() {
  const { dashboardBasePath } = useRole();

  const [includeSold, setIncludeSold] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaHint, setMediaHint] = useState("");
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
      if (!hasMediaReferences) {
        setMediaHint(
          "Media previews are unavailable because the admin products response does not include media references for these products.",
        );
      } else if (Object.keys(mediaMap).length === 0) {
        setMediaHint("Media references were found, but no image previews could be resolved.");
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Real-time pricing, allocations, projected profit, and media preview."
        action={
          <Link
            href={`${dashboardBasePath}/products/add`}
            className="inline-block px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            + New Product
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIncludeSold(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            includeSold
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Include Sold
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-sm text-gray-500">
          Loading products...
        </div>
      )}

      {!loading && error && (
        <div className="space-y-3">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && analytics && (
        <>
          {mediaHint && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              {mediaHint}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Products" value={String(analytics.totals.productCount)} />
            <StatTile
              label="Priced / Unpriced"
              value={`${analytics.totals.pricedProductCount} / ${analytics.totals.unpricedProductCount}`}
            />
            <StatTile
              label="Projected Revenue"
              value={moneyRange(
                analytics.totals.projectedRevenueMin,
                analytics.totals.projectedRevenueMax,
              )}
            />
            <StatTile
              label="Projected Net Profit"
              value={moneyRange(
                analytics.totals.projectedNetProfitMin,
                analytics.totals.projectedNetProfitMax,
              )}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
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
                  </tr>
                </thead>
                <tbody>
                  {analytics.inventory.map((item) => {
                    const productImage = mediaByProductId[item.id];
                    const productImageUrl = productImage?.url || "";

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
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
                                  <svg
                                    className="w-5 h-5 text-gray-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.5}
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                )}
                              </div>

                              <div>
                                <p className="font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">
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
                      </tr>
                    );
                  })}

                  {totalProducts === 0 && (
                    <tr>
                      <td className="px-5 py-10 text-center text-gray-400" colSpan={7}>
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
