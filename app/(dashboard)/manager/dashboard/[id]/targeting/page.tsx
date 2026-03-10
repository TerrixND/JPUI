"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import ManagerCustomerPicker from "@/components/ui/dashboard/ManagerCustomerPicker";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import {
  getPublicMediaUrl,
  handleAccountAccessDeniedError,
  type CustomerTier,
  type MediaVisibilityPreset,
} from "@/lib/apiClient";
import { deriveVisibilityPresetFromMedia } from "@/lib/mediaVisibility";
import {
  createManagerBranchProductRequest,
  getManagerAnalyticsBranches,
  getManagerBranchProductRequests,
  getManagerCustomers,
  getManagerProducts,
  updateManagerProductMediaVisibility,
  updateManagerProductTargeting,
  type ManagerProductMediaReference,
  type ManagerBranchProductRequestRecord,
  type ManagerProductSummary,
  type ManagerProductVisibility,
} from "@/lib/managerApi";
import { managerMoney } from "@/lib/managerDashboardUi";

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

const isManagerProductVisibility = (
  value: string | null,
): value is ManagerProductVisibility =>
  value === "PRIVATE" ||
  value === "STAFF" ||
  value === "PUBLIC" ||
  value === "TOP_SHELF" ||
  value === "USER_TIER" ||
  value === "TARGETED_USER";

const getProductLabel = (product: Pick<ManagerProductSummary, "id" | "sku" | "name">) =>
  [product.sku, product.name].filter(Boolean).join(" · ") || product.id;

type MediaVisibilityDraft = {
  visibilityPreset: MediaVisibilityPreset | "";
  minCustomerTier: "" | CustomerTier;
  targetUserIds: string[];
};

const isImageMedia = (media: Pick<ManagerProductMediaReference, "type" | "mimeType">) => {
  const type = String(media.type || "").trim().toUpperCase();
  const mimeType = String(media.mimeType || "").trim().toUpperCase();
  return type === "IMAGE" || type.startsWith("IMAGE/") || mimeType.startsWith("IMAGE/");
};

const deriveManagerMediaPreset = (media: ManagerProductMediaReference): MediaVisibilityPreset | null =>
  media.visibilityPreset ||
  deriveVisibilityPresetFromMedia({
    visibilityPreset: media.visibilityPreset,
    audience: media.audience,
    visibilitySections: media.visibilitySections,
    allowedRoles: media.allowedRoles,
    minCustomerTier: media.minCustomerTier,
    targetUsers: media.targetUsers,
  });

const getMediaLabel = (media: ManagerProductMediaReference) =>
  [media.slot, media.type].filter(Boolean).join(" · ") || media.id || "Media";

const getProductPreviewUrl = (
  product: ManagerProductSummary,
  resolvedPreviewUrls: Record<string, string>,
) => {
  const directUrl =
    resolvedPreviewUrls[product.id] ||
    product.previewImageUrl ||
    product.media.find((entry) => entry.url)?.url ||
    product.media.find((entry) => entry.originalUrl)?.originalUrl ||
    "";

  return directUrl.trim();
};

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
  const [visibility, setVisibility] = useState<ManagerProductVisibility>("TARGETED_USER");
  const [minCustomerTier, setMinCustomerTier] = useState<"" | "REGULAR" | "VIP" | "ULTRA_VIP">(
    "",
  );
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [visibilityNote, setVisibilityNote] = useState("");
  const [targetCustomersLoading, setTargetCustomersLoading] = useState(false);
  const [targetCustomersError, setTargetCustomersError] = useState("");
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, MediaVisibilityDraft>>({});
  const [mediaSubmittingId, setMediaSubmittingId] = useState("");
  const [mediaNotice, setMediaNotice] = useState("");
  const [mediaError, setMediaError] = useState("");

  const [requestProductIds, setRequestProductIds] = useState<string[]>([]);
  const [requestedCommissionRate, setRequestedCommissionRate] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [productPreviewUrls, setProductPreviewUrls] = useState<Record<string, string>>({});
  const deferredTargetingProductId = useDeferredValue(targetingProductId.trim());

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
  const selectedTargetingProductLabel = selectedTargetingProduct
    ? getProductLabel(selectedTargetingProduct)
    : null;

  useEffect(() => {
    if (!selectedTargetingProduct) {
      setMediaDrafts({});
      setMediaNotice("");
      setMediaError("");
      setMediaSubmittingId("");
      return;
    }

    setMediaDrafts(
      Object.fromEntries(
        selectedTargetingProduct.media
          .filter((media): media is ManagerProductMediaReference & { id: string } => Boolean(media.id))
          .map((media) => {
            const visibilityPreset = deriveManagerMediaPreset(media) || "";
            const targetUserIds = [...new Set(media.targetUsers.map((entry) => entry.userId))];

            return [
              media.id,
              {
                visibilityPreset,
                minCustomerTier: media.minCustomerTier || "",
                targetUserIds,
              } satisfies MediaVisibilityDraft,
            ];
          }),
      ),
    );
    setMediaNotice("");
    setMediaError("");
    setMediaSubmittingId("");
  }, [selectedTargetingProduct]);

  useEffect(() => {
    const productId = deferredTargetingProductId;
    if (!branchId || !productId) {
      setSelectedCustomerIds([]);
      setTargetCustomersError("");
      setTargetCustomersLoading(false);
      return;
    }

    let cancelled = false;

    const loadTargetedCustomers = async () => {
      setTargetCustomersLoading(true);
      setTargetCustomersError("");

      try {
        const accessToken = await getAccessToken();
        const firstPage = await getManagerCustomers({
          accessToken,
          branchId,
          productId,
          page: 1,
          limit: 200,
        });

        const pageLoads: Array<ReturnType<typeof getManagerCustomers>> = [];
        for (let page = 2; page <= firstPage.totalPages; page += 1) {
          pageLoads.push(
            getManagerCustomers({
              accessToken,
              branchId,
              productId,
              page,
              limit: 200,
            }),
          );
        }

        const laterPages = pageLoads.length ? await Promise.all(pageLoads) : [];
        const records = [
          ...firstPage.records,
          ...laterPages.flatMap((response) => response.records),
        ];
        const targetedIds = [...new Set(
          records
            .filter((customer) => customer.isTargetedForProduct)
            .map((customer) => customer.userId),
        )];

        if (cancelled) {
          return;
        }

        setSelectedCustomerIds(targetedIds);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setSelectedCustomerIds([]);
        setTargetCustomersError(getErrorMessage(caughtError));
      } finally {
        if (!cancelled) {
          setTargetCustomersLoading(false);
        }
      }
    };

    void loadTargetedCustomers();

    return () => {
      cancelled = true;
    };
  }, [branchId, deferredTargetingProductId, getAccessToken]);

  const onSubmitTargeting = async () => {
    if (!branchId || !targetingProductId.trim()) {
      setError("Branch and product ID are required before updating targeting.");
      return;
    }

    setError("");
    setNotice("");

    if (visibility === "USER_TIER" && !minCustomerTier) {
      setError("Select a minimum customer tier for USER_TIER visibility.");
      return;
    }
    if (visibility === "TARGETED_USER" && selectedCustomerIds.length === 0) {
      setError("Select at least one customer for TARGETED_USER visibility.");
      return;
    }

    const userIds = visibility === "TARGETED_USER" ? selectedCustomerIds : [];

    setTargetingSubmitting(true);

    try {
      const accessToken = await getAccessToken();
      const result = await updateManagerProductTargeting({
        accessToken,
        productId: targetingProductId.trim(),
        branchId,
        visibility,
        minCustomerTier: visibility === "USER_TIER" ? minCustomerTier || undefined : undefined,
        userIds,
        visibilityNote: visibilityNote || undefined,
      });

      setNotice(result.message || "Product targeting request submitted.");
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

  const onUseProductAsTargetingInput = (product: ManagerProductSummary) => {
    setTargetingProductId(product.id);
    setVisibility(isManagerProductVisibility(product.visibility) ? product.visibility : "STAFF");
    setMinCustomerTier(product.minCustomerTier || "");
  };

  const setMediaDraft = (
    mediaId: string,
    updater: (current: MediaVisibilityDraft) => MediaVisibilityDraft,
  ) => {
    setMediaDrafts((current) => {
      const existing = current[mediaId] || {
        visibilityPreset: "",
        minCustomerTier: "",
        targetUserIds: [],
      };

      return {
        ...current,
        [mediaId]: updater(existing),
      };
    });
  };

  const onSubmitMediaVisibility = async (media: ManagerProductMediaReference) => {
    if (!selectedTargetingProduct || !media.id) {
      setMediaError("Select a product and media record before updating media visibility.");
      return;
    }

    const draft = mediaDrafts[media.id];
    if (!draft?.visibilityPreset) {
      setMediaError("Select a media visibility preset before saving.");
      return;
    }
    if (draft.visibilityPreset === "USER_TIER" && !draft.minCustomerTier) {
      setMediaError("Select a minimum customer tier for USER_TIER media visibility.");
      return;
    }
    if (draft.visibilityPreset === "TARGETED_USER" && draft.targetUserIds.length === 0) {
      setMediaError("Select at least one customer for TARGETED_USER media visibility.");
      return;
    }

    setMediaSubmittingId(media.id);
    setMediaError("");
    setMediaNotice("");

    try {
      const accessToken = await getAccessToken();
      const result = await updateManagerProductMediaVisibility({
        accessToken,
        productId: selectedTargetingProduct.id,
        mediaId: media.id,
        branchId,
        visibilityPreset: draft.visibilityPreset,
        minCustomerTier:
          draft.visibilityPreset === "USER_TIER" ? draft.minCustomerTier || undefined : undefined,
        userIds:
          draft.visibilityPreset === "TARGETED_USER" ? draft.targetUserIds : undefined,
      });

      setMediaNotice(result.message || "Media visibility updated.");
      await loadProductsAndRequests(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setMediaError(getErrorMessage(caughtError));
    } finally {
      setMediaSubmittingId("");
    }
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
                setSelectedCustomerIds([]);
                setMinCustomerTier("");
                setVisibility("TARGETED_USER");
                setVisibilityNote("");
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
              Manager-Visible Products Available For Branch Request
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Non-private products available for branch selection requests.
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">
                No manager-visible products returned for the selected branch scope.
              </div>
            ) : (
              products.map((product) => {
                const requestDisabled = product.isSelectedForBranch;
                const previewUrl = getProductPreviewUrl(product, productPreviewUrls);
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
                              Sale range:{" "}
                              {product.saleRangeMin !== null ? managerMoney.format(product.saleRangeMin) : "-"}
                              {" - "}
                              {product.saleRangeMax !== null ? managerMoney.format(product.saleRangeMax) : "-"}
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
                        onClick={() => onUseProductAsTargetingInput(product)}
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
                {selectedTargetingProductLabel}
              </p>
            )}
            {selectedTargetingProduct && !selectedTargetingProduct.isSelectedForBranch && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This product is visible to managers, but targeting updates usually require it to
                already be active in the branch.
              </p>
            )}
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as ManagerProductVisibility)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
            >
              <option value="PRIVATE">PRIVATE</option>
              <option value="STAFF">STAFF</option>
              <option value="PUBLIC">PUBLIC</option>
              <option value="TOP_SHELF">TOP_SHELF</option>
              <option value="USER_TIER">USER_TIER</option>
              <option value="TARGETED_USER">TARGETED_USER</option>
            </select>
            {visibility === "USER_TIER" && (
              <select
                value={minCustomerTier}
                onChange={(event) =>
                  setMinCustomerTier(event.target.value as "" | "REGULAR" | "VIP" | "ULTRA_VIP")
                }
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg"
              >
                <option value="">Select tier minimum</option>
                <option value="REGULAR">REGULAR</option>
                <option value="VIP">VIP</option>
                <option value="ULTRA_VIP">ULTRA_VIP</option>
              </select>
            )}
            {visibility === "TARGETED_USER" && (
              <ManagerCustomerPicker
                branchId={branchId}
                productId={targetingProductId.trim()}
                selectedIds={selectedCustomerIds}
                onChange={setSelectedCustomerIds}
                getAccessToken={getAccessToken}
                disabled={!branchId || !targetingProductId.trim()}
              />
            )}
            {targetCustomersLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Loading currently targeted customers for this product...
              </p>
            )}
            {targetCustomersError && (
              <p className="text-xs text-red-600 dark:text-red-300">{targetCustomersError}</p>
            )}
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
              Product Media Visibility
            </h3>
            {!selectedTargetingProduct ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pick a product above to review and edit manager-accessible media visibility.
              </p>
            ) : selectedTargetingProduct.media.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No manager-visible media returned for this product.
              </p>
            ) : (
              <>
                {!selectedTargetingProduct.isSelectedForBranch && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This product is not marked as branch-selected in the catalog response. Media
                    edits may still work if the branch currently holds the product, but the backend
                    will enforce that rule.
                  </p>
                )}
                {mediaNotice && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                    {mediaNotice}
                  </div>
                )}
                {mediaError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
                    {mediaError}
                  </div>
                )}
                <div className="space-y-4">
                  {selectedTargetingProduct.media.map((media) => {
                    const mediaId = media.id || "";
                    const draft = mediaId
                      ? mediaDrafts[mediaId] || {
                          visibilityPreset: deriveManagerMediaPreset(media) || "",
                          minCustomerTier: media.minCustomerTier || "",
                          targetUserIds: [...new Set(media.targetUsers.map((entry) => entry.userId))],
                        }
                      : {
                          visibilityPreset: deriveManagerMediaPreset(media) || "",
                          minCustomerTier: media.minCustomerTier || "",
                          targetUserIds: [...new Set(media.targetUsers.map((entry) => entry.userId))],
                        };
                    const currentPreset = deriveManagerMediaPreset(media);
                    const mediaPreviewUrl = media.url || media.originalUrl || "";

                    return (
                      <div
                        key={mediaId || `${media.slot || media.type || "media"}-${media.displayOrder ?? 0}`}
                        className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700/60"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-400 dark:border-gray-700/60 dark:bg-gray-800/50 dark:text-gray-500">
                            {mediaPreviewUrl && isImageMedia(media) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={mediaPreviewUrl}
                                alt={`${getMediaLabel(media)} preview`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span>{media.type || "Media"}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {getMediaLabel(media)}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Current preset: {currentPreset || "Unspecified"} · Audience:{" "}
                              {media.audience || "-"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Allowed roles: {media.allowedRoles.length ? media.allowedRoles.join(", ") : "-"} ·
                              Sections:{" "}
                              {media.visibilitySections.length ? media.visibilitySections.join(", ") : "-"}
                            </p>
                          </div>
                        </div>

                        <select
                          value={draft.visibilityPreset}
                          onChange={(event) =>
                            setMediaDraft(mediaId, (current) => ({
                              ...current,
                              visibilityPreset: event.target.value as MediaVisibilityPreset | "",
                              minCustomerTier:
                                event.target.value === "USER_TIER" ? current.minCustomerTier : "",
                              targetUserIds:
                                event.target.value === "TARGETED_USER" ? current.targetUserIds : [],
                            }))
                          }
                          disabled={!mediaId || mediaSubmittingId === mediaId}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-800/50"
                        >
                          <option value="">Select media visibility</option>
                          <option value="PUBLIC">PUBLIC</option>
                          <option value="TOP_SHELF">TOP_SHELF</option>
                          <option value="USER_TIER">USER_TIER</option>
                          <option value="TARGETED_USER">TARGETED_USER</option>
                          <option value="PRIVATE">PRIVATE</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="SALES">SALES</option>
                        </select>

                        {draft.visibilityPreset === "USER_TIER" && (
                          <select
                            value={draft.minCustomerTier}
                            onChange={(event) =>
                              setMediaDraft(mediaId, (current) => ({
                                ...current,
                                minCustomerTier: event.target.value as "" | CustomerTier,
                              }))
                            }
                            disabled={!mediaId || mediaSubmittingId === mediaId}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-800/50"
                          >
                            <option value="">Select tier minimum</option>
                            <option value="REGULAR">REGULAR</option>
                            <option value="VIP">VIP</option>
                            <option value="ULTRA_VIP">ULTRA_VIP</option>
                          </select>
                        )}

                        {draft.visibilityPreset === "TARGETED_USER" && (
                          <ManagerCustomerPicker
                            branchId={branchId}
                            productId={selectedTargetingProduct.id}
                            selectedIds={draft.targetUserIds}
                            onChange={(nextIds) =>
                              setMediaDraft(mediaId, (current) => ({
                                ...current,
                                targetUserIds: nextIds,
                              }))
                            }
                            getAccessToken={getAccessToken}
                            disabled={!mediaId || mediaSubmittingId === mediaId}
                            label="Media Target Customers"
                            helperText="Search customers and choose which users can access this specific media item."
                            emptyStateLabel="No matching customers found for media targeting."
                            annotateProductTargeting={false}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => void onSubmitMediaVisibility(media)}
                          disabled={!mediaId || mediaSubmittingId === mediaId}
                          className="w-full rounded-lg bg-emerald-600 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {mediaSubmittingId === mediaId ? "Saving..." : "Save Media Visibility"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Branch Product Request
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Selected manager-visible products: {requestProductIds.length}
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
