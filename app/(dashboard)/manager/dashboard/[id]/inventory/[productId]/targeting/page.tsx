"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ManagerCustomerPicker from "@/components/ui/dashboard/ManagerCustomerPicker";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  handleAccountAccessDeniedError,
  type CustomerTier,
  type MediaVisibilityPreset,
} from "@/lib/apiClient";
import { deriveVisibilityPresetFromMedia } from "@/lib/mediaVisibility";
import {
  getManagerAnalyticsBranches,
  getManagerCustomers,
  getManagerProducts,
  updateManagerProductMediaVisibility,
  updateManagerProductTargeting,
  type ManagerProductMediaReference,
  type ManagerProductSummary,
  type ManagerProductVisibility,
} from "@/lib/managerApi";
import { getManagerProductLabel } from "@/lib/managerDashboardUi";

type MediaVisibilityDraft = {
  visibilityPreset: MediaVisibilityPreset | "";
  minCustomerTier: "" | CustomerTier;
  targetUserIds: string[];
};

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

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

const createMediaDraft = (media: ManagerProductMediaReference): MediaVisibilityDraft => ({
  visibilityPreset: deriveManagerMediaPreset(media) || "",
  minCustomerTier: media.minCustomerTier || "",
  targetUserIds: [
    ...new Set(
      media.targetUsers
        .map((entry) => entry.userId)
        .filter((entry): entry is string => Boolean(entry)),
    ),
  ],
});

const mergeMediaDraft = (
  draft: MediaVisibilityDraft,
  patch: Partial<MediaVisibilityDraft>,
): MediaVisibilityDraft => ({
  visibilityPreset: patch.visibilityPreset ?? draft.visibilityPreset,
  minCustomerTier: patch.minCustomerTier ?? draft.minCustomerTier,
  targetUserIds: patch.targetUserIds ?? draft.targetUserIds,
});

const isImageMedia = (media: Pick<ManagerProductMediaReference, "type" | "mimeType">) => {
  const type = String(media.type || "").trim().toUpperCase();
  const mimeType = String(media.mimeType || "").trim().toUpperCase();
  return type === "IMAGE" || type.startsWith("IMAGE/") || mimeType.startsWith("IMAGE/");
};

export default function ManagerInventoryTargetingPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const productId = String(params.productId || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mediaSavingId, setMediaSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [product, setProduct] = useState<ManagerProductSummary | null>(null);
  const [visibility, setVisibility] = useState<ManagerProductVisibility>("STAFF");
  const [minCustomerTier, setMinCustomerTier] = useState<"" | CustomerTier>("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [visibilityNote, setVisibilityNote] = useState("");
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, MediaVisibilityDraft>>({});

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
        const matchedProduct =
          response.products.find((entry) => entry.id === productId) || null;
        setProduct(matchedProduct);
        if (matchedProduct) {
          setVisibility(matchedProduct.visibility || "STAFF");
          setMinCustomerTier(matchedProduct.minCustomerTier || "");
          setMediaDrafts(
            Object.fromEntries(
              matchedProduct.media
                .filter((media): media is ManagerProductMediaReference & { id: string } => Boolean(media.id))
                .map((media) => [media.id, createMediaDraft(media)]),
            ),
          );
        }
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

  useEffect(() => {
    const loadTargetedCustomers = async () => {
      if (!branchId || !productId || visibility !== "TARGETED_USER") {
        return;
      }

      try {
        const accessToken = await getAccessToken();
        const response = await getManagerCustomers({
          accessToken,
          branchId,
          productId,
          page: 1,
          limit: 200,
        });
        setSelectedCustomerIds(
          response.records
            .filter((customer) => customer.isTargetedForProduct)
            .map((customer) => customer.userId),
        );
      } catch {
        setSelectedCustomerIds([]);
      }
    };

    void loadTargetedCustomers();
  }, [branchId, getAccessToken, productId, visibility]);

  const saveTargeting = async () => {
    if (!branchId || !product) {
      return;
    }
    if (visibility === "USER_TIER" && !minCustomerTier) {
      setError("Select a minimum tier for USER_TIER visibility.");
      return;
    }
    if (visibility === "TARGETED_USER" && selectedCustomerIds.length === 0) {
      setError("Select at least one customer for TARGETED_USER visibility.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await updateManagerProductTargeting({
        accessToken,
        productId: product.id,
        branchId,
        visibility,
        minCustomerTier: visibility === "USER_TIER" ? minCustomerTier || undefined : undefined,
        userIds: visibility === "TARGETED_USER" ? selectedCustomerIds : undefined,
        visibilityNote: visibilityNote || undefined,
      });
      setNotice(response.message || "Targeting updated.");
      await loadProduct(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  const saveMediaVisibility = async (media: ManagerProductMediaReference) => {
    if (!branchId || !product || !media.id) {
      return;
    }

    const draft = mediaDrafts[media.id];
    if (!draft?.visibilityPreset) {
      setError("Select a media visibility preset before saving.");
      return;
    }
    if (draft.visibilityPreset === "USER_TIER" && !draft.minCustomerTier) {
      setError("Select a minimum tier for USER_TIER media visibility.");
      return;
    }
    if (draft.visibilityPreset === "TARGETED_USER" && draft.targetUserIds.length === 0) {
      setError("Select at least one customer for TARGETED_USER media visibility.");
      return;
    }

    setMediaSavingId(media.id);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await updateManagerProductMediaVisibility({
        accessToken,
        productId: product.id,
        mediaId: media.id,
        branchId,
        visibilityPreset: draft.visibilityPreset,
        minCustomerTier:
          draft.visibilityPreset === "USER_TIER" ? draft.minCustomerTier || undefined : undefined,
        userIds:
          draft.visibilityPreset === "TARGETED_USER" ? draft.targetUserIds : undefined,
      });
      setNotice(response.message || "Media visibility updated.");
      await loadProduct(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setMediaSavingId("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={product ? `${getManagerProductLabel(product)} Targeting` : "Targeting & Visibility"}
        description="Inventory-level targeting and manager-visible media visibility controls for this branch product."
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
              href={`${dashboardBasePath}/inventory`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Inventory
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
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900" />
          <div className="h-80 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900" />
        </div>
      ) : !product ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
          This product was not found in branch inventory.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Targeting
            </h2>
            <div className="mt-3 space-y-3">
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as ManagerProductVisibility)
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              >
                <option value="PRIVATE">PRIVATE</option>
                <option value="STAFF">STAFF</option>
                <option value="PUBLIC">PUBLIC</option>
                <option value="TOP_SHELF">TOP_SHELF</option>
                <option value="USER_TIER">USER_TIER</option>
                <option value="TARGETED_USER">TARGETED_USER</option>
              </select>

              {visibility === "USER_TIER" ? (
                <select
                  value={minCustomerTier}
                  onChange={(event) =>
                    setMinCustomerTier(event.target.value as "" | CustomerTier)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="">Select minimum tier</option>
                  <option value="REGULAR">REGULAR</option>
                  <option value="VIP">VIP</option>
                  <option value="ULTRA_VIP">ULTRA_VIP</option>
                </select>
              ) : null}

              {visibility === "TARGETED_USER" ? (
                <ManagerCustomerPicker
                  branchId={branchId}
                  productId={product.id}
                  selectedIds={selectedCustomerIds}
                  onChange={setSelectedCustomerIds}
                  getAccessToken={getAccessToken}
                />
              ) : null}

              <input
                value={visibilityNote}
                onChange={(event) => setVisibilityNote(event.target.value)}
                placeholder="Visibility note"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={() => {
                  void saveTargeting();
                }}
                disabled={saving}
                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Targeting"}
              </button>
            </div>
          </aside>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Media Visibility
            </h2>
            <div className="mt-4 space-y-4">
              {product.media.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                  No media returned for this product.
                </div>
              ) : (
                product.media.map((media) => {
                  const mediaId = media.id || "";
                  const draft: MediaVisibilityDraft =
                    (mediaId ? mediaDrafts[mediaId] : null) || createMediaDraft(media);
                  const mediaPreviewUrl = media.url || media.originalUrl || "";

                  return (
                    <div
                      key={mediaId || `${media.slot || media.type}-${media.displayOrder ?? 0}`}
                      className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700/60"
                    >
                      <div className="flex gap-4">
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-400 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-500">
                          {mediaPreviewUrl && isImageMedia(media) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaPreviewUrl}
                              alt={media.slot || media.type || "Media"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{media.type || "Media"}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {media.slot || media.type || media.id || "Media"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Current preset: {deriveManagerMediaPreset(media) || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <select
                          value={draft.visibilityPreset}
                          onChange={(event) =>
                            setMediaDrafts((current) => ({
                              ...current,
                              [mediaId]: mergeMediaDraft(draft, {
                                visibilityPreset: event.target.value as MediaVisibilityPreset | "",
                              }),
                            }))
                          }
                          disabled={!mediaId || mediaSavingId === mediaId}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
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

                        {draft.visibilityPreset === "USER_TIER" ? (
                          <select
                            value={draft.minCustomerTier}
                            onChange={(event) =>
                              setMediaDrafts((current) => ({
                                ...current,
                                [mediaId]: mergeMediaDraft(draft, {
                                  minCustomerTier: event.target.value as "" | CustomerTier,
                                }),
                              }))
                            }
                            disabled={!mediaId || mediaSavingId === mediaId}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                          >
                            <option value="">Select minimum tier</option>
                            <option value="REGULAR">REGULAR</option>
                            <option value="VIP">VIP</option>
                            <option value="ULTRA_VIP">ULTRA_VIP</option>
                          </select>
                        ) : null}

                        {draft.visibilityPreset === "TARGETED_USER" ? (
                          <ManagerCustomerPicker
                            branchId={branchId}
                            productId={product.id}
                            selectedIds={draft.targetUserIds}
                            onChange={(nextIds) =>
                              setMediaDrafts((current) => ({
                                ...current,
                                [mediaId]: mergeMediaDraft(draft, {
                                  targetUserIds: nextIds,
                                }),
                              }))
                            }
                            getAccessToken={getAccessToken}
                            label="Media Target Customers"
                            helperText="Choose which customers can access this media."
                            annotateProductTargeting={false}
                          />
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            void saveMediaVisibility(media);
                          }}
                          disabled={!mediaId || mediaSavingId === mediaId}
                          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {mediaSavingId === mediaId ? "Saving..." : "Save Media Visibility"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
