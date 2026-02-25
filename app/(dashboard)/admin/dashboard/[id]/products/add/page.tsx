"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import MediaUploader, { type MediaFile } from "@/components/ui/dashboard/MediaUploader";
import supabase from "@/lib/supabase";
import { uploadMediaFiles } from "@/lib/mediaUpload";
import { type CustomerTier, type MediaVisibilityPreset } from "@/lib/apiClient";
import {
  CUSTOMER_TIER_OPTIONS as MEDIA_CUSTOMER_TIER_OPTIONS,
  PUBLIC_MEDIA_VISIBILITY_PRESETS,
  ROLE_MEDIA_VISIBILITY_PRESETS,
  parseTargetUserIdsInput,
} from "@/lib/mediaVisibility";
import { getAdminActionRestrictionTooltip } from "@/lib/adminAccessControl";

type ProductForm = {
  sku: string;
  name: string;
  color: string;
  weight: string;
  length: string;
  depth: string;
  height: string;
  importDate: string;
  importId: string;
  fromCompanyId: string;
  visibility: string;
  visibilityNote: string;
  tier: string;
  status: string;
  minCustomerTier: string;
  sourceType: string;
  consignmentAgreementId: string;
  buyPrice: string;
  saleMinPrice: string;
  saleMaxPrice: string;
};

type CommissionTargetType = "BRANCH" | "USER";

type AllocationRow = {
  id: string;
  targetType: CommissionTargetType;
  branchId: string;
  managerBranchId: string;
  userId: string;
  rate: string;
  note: string;
};

type ApiErrorPayload = {
  message?: string;
  code?: string;
  reason?: string;
};

type BranchAnalyticsResponse = {
  branches?: BranchOption[];
  message?: string;
};

type BranchOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: string;
};

type BranchMember = {
  memberRole?: string;
  user?: {
    id?: string;
    email?: string | null;
    status?: string | null;
    role?: string | null;
    managerProfile?: {
      displayName?: string | null;
    } | null;
    salespersonProfile?: {
      displayName?: string | null;
    } | null;
    customerProfile?: {
      displayName?: string | null;
    } | null;
  } | null;
};

type ManagerOption = {
  id: string;
  label: string;
};

const initialForm: ProductForm = {
  sku: "",
  name: "",
  color: "",
  weight: "",
  length: "",
  depth: "",
  height: "",
  importDate: "",
  importId: "",
  fromCompanyId: "",
  visibility: "PRIVATE",
  visibilityNote: "",
  tier: "STANDARD",
  status: "AVAILABLE",
  minCustomerTier: "",
  sourceType: "OWNED",
  consignmentAgreementId: "",
  buyPrice: "",
  saleMinPrice: "",
  saleMaxPrice: "",
};

const VISIBILITY_OPTIONS = ["PRIVATE", "PUBLIC", "TOP_SHELF", "TARGETED"];
const TIER_OPTIONS = ["STANDARD", "VIP", "ULTRA_RARE"];
const STATUS_OPTIONS = ["AVAILABLE", "PENDING", "BUSY", "SOLD"];
const PRODUCT_CUSTOMER_TIER_OPTIONS = ["", "REGULAR", "VIP", "ULTRA_VIP"];
const SOURCE_TYPE_OPTIONS = ["OWNED", "CONSIGNED"];
type PublicMediaVisibilityPreset = Extract<
  MediaVisibilityPreset,
  "PUBLIC" | "TOP_SHELF" | "USER_TIER" | "TARGETED_USER" | "PRIVATE"
>;
type RoleMediaVisibilityPreset = Extract<MediaVisibilityPreset, "ADMIN" | "MANAGER" | "SALES">;

const createAllocationRow = (): AllocationRow => ({
  id: `allocation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  targetType: "BRANCH",
  branchId: "",
  managerBranchId: "",
  userId: "",
  rate: "",
  note: "",
});

const toErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  const message = payload?.message || fallback;
  const code = payload?.code ? ` (code: ${payload.code})` : "";
  const reason = payload?.reason ? ` (reason: ${payload.reason})` : "";
  return `${message}${code}${reason}`;
};

const formatBranchLabel = (branch: BranchOption) => {
  const code = branch.code ? `${branch.code} - ` : "";
  const city = branch.city ? ` (${branch.city})` : "";
  const status = branch.status !== "ACTIVE" ? ` [${branch.status}]` : "";
  return `${code}${branch.name}${city}${status}`;
};

const parseOptionalNumber = (value: string, fieldLabel: string) => {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a non-negative number.`);
  }

  return parsed;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
      {children}
    </h2>
  );
}

export default function AddProductPage() {
  const router = useRouter();
  const { dashboardBasePath, isAdminActionBlocked } = useRole();
  const productCreateBlocked = isAdminActionBlocked("PRODUCT_CREATE");
  const productCreateTooltip = getAdminActionRestrictionTooltip("PRODUCT_CREATE");

  const [form, setForm] = useState<ProductForm>(initialForm);
  const [publicVisibilityPreset, setPublicVisibilityPreset] = useState<PublicMediaVisibilityPreset>("PUBLIC");
  const [publicMinCustomerTier, setPublicMinCustomerTier] = useState<CustomerTier | "">("");
  const [publicTargetUserIdsInput, setPublicTargetUserIdsInput] = useState("");
  const [publicThumbnailFiles, setPublicThumbnailFiles] = useState<MediaFile[]>([]);
  const [publicVideoFiles, setPublicVideoFiles] = useState<MediaFile[]>([]);
  const [publicGalleryFiles, setPublicGalleryFiles] = useState<MediaFile[]>([]);
  const [publicCertificateFiles, setPublicCertificateFiles] = useState<MediaFile[]>([]);
  const [roleVisibilityPreset, setRoleVisibilityPreset] = useState<RoleMediaVisibilityPreset>("ADMIN");
  const [roleMediaFiles, setRoleMediaFiles] = useState<MediaFile[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [managersByBranch, setManagersByBranch] = useState<Record<string, ManagerOption[]>>({});
  const [loadingManagersByBranch, setLoadingManagersByBranch] = useState<Record<string, boolean>>(
    {},
  );

  const [branchesLoading, setBranchesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");

  const productsPath = `${dashboardBasePath}/products`;

  const totalAllocationRate = useMemo(() => {
    return allocations.reduce((sum, row) => {
      const rate = Number(row.rate);
      if (!Number.isFinite(rate)) {
        return sum;
      }

      return sum + rate;
    }, 0);
  }, [allocations]);

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

  const loadBranchManagers = useCallback(
    async (branchId: string) => {
      if (!branchId) {
        return;
      }

      if (managersByBranch[branchId] || loadingManagersByBranch[branchId]) {
        return;
      }

      setLoadingManagersByBranch((prev) => ({
        ...prev,
        [branchId]: true,
      }));

      try {
        const accessToken = await getAccessToken();

        const response = await fetch(`/api/v1/admin/branches/${branchId}/members`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | ApiErrorPayload
          | BranchMember[]
          | null;

        if (!response.ok) {
          throw new Error(
            toErrorMessage(payload as ApiErrorPayload | null, "Failed to load branch managers."),
          );
        }

        const members = Array.isArray(payload) ? payload : [];

        const dedupe = new Set<string>();
        const managers: ManagerOption[] = [];

        for (const member of members) {
          const isManagerRow = String(member?.memberRole || "").toUpperCase() === "MANAGER";
          const user = member?.user;
          const userId = user?.id || "";
          const userStatus = String(user?.status || "").toUpperCase();

          if (!isManagerRow || !userId || userStatus !== "ACTIVE" || dedupe.has(userId)) {
            continue;
          }

          const displayName =
            user?.managerProfile?.displayName ||
            user?.salespersonProfile?.displayName ||
            user?.customerProfile?.displayName ||
            user?.email ||
            userId;

          managers.push({
            id: userId,
            label: displayName,
          });

          dedupe.add(userId);
        }

        setManagersByBranch((prev) => ({
          ...prev,
          [branchId]: managers,
        }));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to load branch managers.";

        setLookupError(message);
      } finally {
        setLoadingManagersByBranch((prev) => ({
          ...prev,
          [branchId]: false,
        }));
      }
    },
    [getAccessToken, loadingManagersByBranch, managersByBranch],
  );

  useEffect(() => {
    const loadBranches = async () => {
      setBranchesLoading(true);
      setLookupError("");

      try {
        const accessToken = await getAccessToken();

        const response = await fetch("/api/v1/admin/analytics/branches", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | ApiErrorPayload
          | BranchAnalyticsResponse
          | null;

        if (!response.ok) {
          throw new Error(toErrorMessage(payload as ApiErrorPayload | null, "Failed to load branches."));
        }

        const branchRows = Array.isArray((payload as BranchAnalyticsResponse)?.branches)
          ? ((payload as BranchAnalyticsResponse).branches as BranchOption[])
          : [];

        setBranches(branchRows);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to load branches.";

        setLookupError(message);
      } finally {
        setBranchesLoading(false);
      }
    };

    void loadBranches();
  }, [getAccessToken]);

  const updateField = (field: keyof ProductForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAllocation = (allocationId: string, patch: Partial<AllocationRow>) => {
    setAllocations((prev) => prev.map((row) => (row.id === allocationId ? { ...row, ...patch } : row)));
  };

  const addAllocation = () => {
    setAllocations((prev) => [...prev, createAllocationRow()]);
  };

  const removeAllocation = (allocationId: string) => {
    setAllocations((prev) => prev.filter((row) => row.id !== allocationId));
  };

  const hasAnyPublicMedia =
    publicThumbnailFiles.length > 0 ||
    publicVideoFiles.length > 0 ||
    publicGalleryFiles.length > 0 ||
    publicCertificateFiles.length > 0;
  const hasAnyMedia = hasAnyPublicMedia || roleMediaFiles.length > 0;

  const ensureMediaUploadMetadata = () => {
    if (!hasAnyMedia) {
      return;
    }

    if (!hasAnyPublicMedia) {
      return;
    }

    if (!publicThumbnailFiles.length) {
      throw new Error("Public media requires a thumbnail image.");
    }

    if (!publicVideoFiles.length) {
      throw new Error("Public media requires at least one video.");
    }

    if (publicVisibilityPreset === "USER_TIER" && !publicMinCustomerTier) {
      throw new Error("Select a minimum customer tier for USER_TIER public media.");
    }

    if (
      publicVisibilityPreset === "TARGETED_USER" &&
      parseTargetUserIdsInput(publicTargetUserIdsInput).length === 0
    ) {
      throw new Error("Provide at least one target user id for TARGETED_USER public media.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (productCreateBlocked) {
      setError(productCreateTooltip);
      return;
    }

    if (!form.sku.trim()) {
      setError("SKU is required.");
      return;
    }

    try {
      const buyPrice = parseOptionalNumber(form.buyPrice, "Buy price");
      const saleMinPrice = parseOptionalNumber(form.saleMinPrice, "Minimum sale price");
      const saleMaxPrice = parseOptionalNumber(form.saleMaxPrice, "Maximum sale price");

      if (saleMinPrice !== null && saleMaxPrice !== null && saleMaxPrice < saleMinPrice) {
        throw new Error("Maximum sale price must be greater than or equal to minimum sale price.");
      }

      const normalizedAllocations = allocations.map((row, index) => {
        const rate = Number(row.rate);

        if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
          throw new Error(`Allocation #${index + 1} rate must be between 0 and 100.`);
        }

        if (row.targetType === "BRANCH") {
          if (!row.branchId) {
            throw new Error(`Allocation #${index + 1} requires a branch.`);
          }

          return {
            targetType: "BRANCH" as const,
            branchId: row.branchId,
            rate,
            note: row.note.trim() || undefined,
          };
        }

        if (!row.userId) {
          throw new Error(`Allocation #${index + 1} requires a manager.`);
        }

        return {
          targetType: "USER" as const,
          userId: row.userId,
          rate,
          note: row.note.trim() || undefined,
        };
      });

      const totalRate = normalizedAllocations.reduce((sum, row) => sum + row.rate, 0);
      if (totalRate > 100) {
        throw new Error("Total commission allocation rate cannot exceed 100%.");
      }

      ensureMediaUploadMetadata();
      setLoading(true);

      const accessToken = await getAccessToken();

      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim() || null,
        color: form.color.trim() || null,
        weight: form.weight ? parseFloat(form.weight) : null,
        length: form.length ? parseFloat(form.length) : null,
        depth: form.depth ? parseFloat(form.depth) : null,
        height: form.height ? parseFloat(form.height) : null,
        importDate: form.importDate || null,
        importId: form.importId.trim() || null,
        fromCompanyId: form.fromCompanyId.trim() || null,
        visibility: form.visibility,
        visibilityNote: form.visibilityNote.trim() || null,
        tier: form.tier,
        status: form.status,
        minCustomerTier: form.minCustomerTier || null,
        sourceType: form.sourceType,
        consignmentAgreementId:
          form.sourceType === "CONSIGNED" && form.consignmentAgreementId.trim()
            ? form.consignmentAgreementId.trim()
            : null,
        buyPrice,
        saleMinPrice,
        saleMaxPrice,
        commissionAllocations: normalizedAllocations,
      };

      const mediaIds: string[] = [];
      const publicTargetUserIds = parseTargetUserIdsInput(publicTargetUserIdsInput);

      if (hasAnyPublicMedia) {
        const publicFiles = [
          ...publicThumbnailFiles,
          ...publicVideoFiles,
          ...publicGalleryFiles,
          ...publicCertificateFiles,
        ].map((mediaFile) => mediaFile.file);

        const uploadedPublicMedia = await uploadMediaFiles({
          files: publicFiles,
          accessToken,
          visibilityPreset: publicVisibilityPreset,
          ...(publicVisibilityPreset === "USER_TIER" && publicMinCustomerTier
            ? { minCustomerTier: publicMinCustomerTier }
            : {}),
          ...(publicVisibilityPreset === "TARGETED_USER"
            ? { targetUserIds: publicTargetUserIds }
            : {}),
        });

        mediaIds.push(...uploadedPublicMedia.map((media) => media.id));
      }

      if (roleMediaFiles.length > 0) {
        const uploadedRoleMedia = await uploadMediaFiles({
          files: roleMediaFiles.map((mediaFile) => mediaFile.file),
          accessToken,
          visibilityPreset: roleVisibilityPreset,
        });

        mediaIds.push(...uploadedRoleMedia.map((media) => media.id));
      }

      const createResponse = await fetch("/api/v1/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...payload,
          mediaIds,
        }),
        cache: "no-store",
      });

      const createBody = (await createResponse.json().catch(() => null)) as ApiErrorPayload | null;

      if (!createResponse.ok) {
        throw new Error(toErrorMessage(createBody, "Failed to create product."));
      }

      router.push(productsPath);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create product. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Product"
        description="Fill in the details below to add a new product to the catalog."
        action={
          <Link
            href={productsPath}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back to Products
          </Link>
        }
      />

      {productCreateBlocked && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {productCreateTooltip}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {lookupError && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            {lookupError}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Basic Information</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => updateField("sku", e.target.value)}
                placeholder="e.g. JDE-IMP-2025-0001"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Product name"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Color</label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => updateField("color", e.target.value)}
                placeholder="e.g. Emerald Green"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Pricing &amp; Profit Inputs</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Buy Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.buyPrice}
                onChange={(e) => updateField("buyPrice", e.target.value)}
                placeholder="1000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Sale Min Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.saleMinPrice}
                onChange={(e) => updateField("saleMinPrice", e.target.value)}
                placeholder="1300"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Sale Max Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.saleMaxPrice}
                onChange={(e) => updateField("saleMaxPrice", e.target.value)}
                placeholder="1800"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Commission Allocations</SectionHeading>

          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs text-gray-500">
              Split projected commission by branch or manager/admin user.
            </p>
            <button
              type="button"
              onClick={addAllocation}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              + Add Allocation
            </button>
          </div>

          {allocations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              No allocations yet. Add rows if this product needs partner commission splits.
            </div>
          ) : (
            <div className="space-y-3">
              {allocations.map((row, index) => {
                const managers = row.managerBranchId ? managersByBranch[row.managerBranchId] || [] : [];
                const isManagerLoading = row.managerBranchId
                  ? Boolean(loadingManagersByBranch[row.managerBranchId])
                  : false;

                return (
                  <div key={row.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-700">Allocation #{index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeAllocation(row.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                      <div className="lg:col-span-2">
                        <label className="block text-[12px] text-gray-700 mb-1.5">Target</label>
                        <select
                          value={row.targetType}
                          onChange={(e) => {
                            const nextTarget = e.target.value as CommissionTargetType;

                            updateAllocation(row.id, {
                              targetType: nextTarget,
                              branchId: "",
                              managerBranchId: "",
                              userId: "",
                            });
                          }}
                          className={inputCls}
                        >
                          <option value="BRANCH">BRANCH</option>
                          <option value="USER">USER</option>
                        </select>
                      </div>

                      {row.targetType === "BRANCH" ? (
                        <div className="lg:col-span-4">
                          <label className="block text-[12px] text-gray-700 mb-1.5">Branch</label>
                          <select
                            value={row.branchId}
                            onChange={(e) => updateAllocation(row.id, { branchId: e.target.value })}
                            disabled={branchesLoading}
                            className={inputCls}
                          >
                            <option value="">Select branch</option>
                            {branches.map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {formatBranchLabel(branch)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div className="lg:col-span-4">
                            <label className="block text-[12px] text-gray-700 mb-1.5">
                              Manager Branch
                            </label>
                            <select
                              value={row.managerBranchId}
                              onChange={(e) => {
                                const branchId = e.target.value;

                                updateAllocation(row.id, {
                                  managerBranchId: branchId,
                                  userId: "",
                                });

                                if (branchId) {
                                  void loadBranchManagers(branchId);
                                }
                              }}
                              disabled={branchesLoading}
                              className={inputCls}
                            >
                              <option value="">Select branch</option>
                              {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                  {formatBranchLabel(branch)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="lg:col-span-3">
                            <label className="block text-[12px] text-gray-700 mb-1.5">Manager</label>
                            <select
                              value={row.userId}
                              onChange={(e) => updateAllocation(row.id, { userId: e.target.value })}
                              disabled={!row.managerBranchId || isManagerLoading}
                              className={inputCls}
                            >
                              <option value="">Select manager</option>
                              {managers.map((manager) => (
                                <option key={manager.id} value={manager.id}>
                                  {manager.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      <div className="lg:col-span-2">
                        <label className="block text-[12px] text-gray-700 mb-1.5">Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.rate}
                          onChange={(e) => updateAllocation(row.id, { rate: e.target.value })}
                          placeholder="3.5"
                          className={inputCls}
                        />
                      </div>

                      <div className="lg:col-span-12">
                        <label className="block text-[12px] text-gray-700 mb-1.5">Note</label>
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) => updateAllocation(row.id, { note: e.target.value })}
                          placeholder="Branch pool / Manager share"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-xs">
            <span className="text-gray-500">Total allocated rate: </span>
            <span
              className={
                totalAllocationRate > 100 ? "text-red-600 font-semibold" : "text-gray-700 font-semibold"
              }
            >
              {totalAllocationRate.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Dimensions &amp; Weight</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Weight (g)</label>
              <input
                type="number"
                step="0.01"
                value={form.weight}
                onChange={(e) => updateField("weight", e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Length (mm)</label>
              <input
                type="number"
                step="0.01"
                value={form.length}
                onChange={(e) => updateField("length", e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Depth (mm)</label>
              <input
                type="number"
                step="0.01"
                value={form.depth}
                onChange={(e) => updateField("depth", e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Height (mm)</label>
              <input
                type="number"
                step="0.01"
                value={form.height}
                onChange={(e) => updateField("height", e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Import Details</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Import Date</label>
              <input
                type="date"
                value={form.importDate}
                onChange={(e) => updateField("importDate", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Import ID</label>
              <input
                type="text"
                value={form.importId}
                onChange={(e) => updateField("importId", e.target.value)}
                placeholder="e.g. IMP-2025-TH-7781"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">From Company ID</label>
              <input
                type="text"
                value={form.fromCompanyId}
                onChange={(e) => updateField("fromCompanyId", e.target.value)}
                placeholder="e.g. company-7788"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Classification &amp; Visibility</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => updateField("visibility", e.target.value)}
                className={inputCls}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Tier</label>
              <select
                value={form.tier}
                onChange={(e) => updateField("tier", e.target.value)}
                className={inputCls}
              >
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                className={inputCls}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Min. Customer Tier</label>
              <select
                value={form.minCustomerTier}
                onChange={(e) => updateField("minCustomerTier", e.target.value)}
                className={inputCls}
              >
                {PRODUCT_CUSTOMER_TIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt || "None"}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[13px] text-gray-700 mb-1.5">Visibility Note</label>
              <input
                type="text"
                value={form.visibilityNote}
                onChange={(e) => updateField("visibilityNote", e.target.value)}
                placeholder="Optional note about visibility restrictions"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Sourcing</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Source Type</label>
              <select
                value={form.sourceType}
                onChange={(e) => updateField("sourceType", e.target.value)}
                className={inputCls}
              >
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            {form.sourceType === "CONSIGNED" && (
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">
                  Consignment Agreement ID
                </label>
                <input
                  type="text"
                  value={form.consignmentAgreementId}
                  onChange={(e) => updateField("consignmentAgreementId", e.target.value)}
                  placeholder="UUID of the consignment agreement"
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Public Media Upload</SectionHeading>
          <p className="text-xs text-gray-500 mb-4">
            Use one public preset for customer-facing media. Thumbnail and video are required when
            uploading public media.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Public Visibility
              </label>
              <select
                value={publicVisibilityPreset}
                onChange={(e) => setPublicVisibilityPreset(e.target.value as PublicMediaVisibilityPreset)}
                className={inputCls}
              >
                {PUBLIC_MEDIA_VISIBILITY_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {publicVisibilityPreset === "USER_TIER" && (
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Min Customer Tier
                </label>
                <select
                  value={publicMinCustomerTier}
                  onChange={(e) => setPublicMinCustomerTier(e.target.value as CustomerTier | "")}
                  className={inputCls}
                >
                  <option value="">Select tier</option>
                  {MEDIA_CUSTOMER_TIER_OPTIONS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {publicVisibilityPreset === "TARGETED_USER" && (
              <div className="md:col-span-2">
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Target User IDs
                </label>
                <textarea
                  value={publicTargetUserIdsInput}
                  onChange={(e) => setPublicTargetUserIdsInput(e.target.value)}
                  rows={3}
                  placeholder="Enter user IDs separated by commas or new lines"
                  className={inputCls}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Thumbnail Image</p>
              <MediaUploader
                files={publicThumbnailFiles}
                onChange={setPublicThumbnailFiles}
                maxFiles={1}
                maxSizeMB={50}
                maxVideoSizeMB={500}
                allowedTypes={["IMAGE"]}
                helperText="Upload one primary thumbnail image (required when public media is used)."
              />
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Feature Video (Required)</p>
              <MediaUploader
                files={publicVideoFiles}
                onChange={setPublicVideoFiles}
                maxFiles={1}
                maxSizeMB={50}
                maxVideoSizeMB={500}
                allowedTypes={["VIDEO"]}
                helperText="Upload one product video (required when public media is used)."
              />
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">More Images</p>
              <MediaUploader
                files={publicGalleryFiles}
                onChange={setPublicGalleryFiles}
                maxFiles={12}
                maxSizeMB={50}
                maxVideoSizeMB={500}
                allowedTypes={["IMAGE"]}
                helperText="Upload additional gallery images."
              />
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Certificate File</p>
              <MediaUploader
                files={publicCertificateFiles}
                onChange={setPublicCertificateFiles}
                maxFiles={1}
                maxSizeMB={50}
                maxVideoSizeMB={500}
                allowedTypes={["PDF"]}
                helperText="Upload one PDF certificate file."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Role Based Media Upload</SectionHeading>
          <p className="text-xs text-gray-500 mb-4">
            Upload internal media and restrict access to one role preset.
          </p>

          <div className="mb-4">
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Role Visibility
            </label>
            <select
              value={roleVisibilityPreset}
              onChange={(e) => setRoleVisibilityPreset(e.target.value as RoleMediaVisibilityPreset)}
              className={inputCls}
            >
              {ROLE_MEDIA_VISIBILITY_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>

          <MediaUploader
            files={roleMediaFiles}
            onChange={setRoleMediaFiles}
            maxFiles={20}
            maxSizeMB={50}
            maxVideoSizeMB={500}
            allowedTypes={["IMAGE", "VIDEO", "PDF"]}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={productsPath}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || productCreateBlocked}
            title={productCreateBlocked ? productCreateTooltip : undefined}
            className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating..." : productCreateBlocked ? "Create Product (Restricted)" : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
