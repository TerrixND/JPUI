"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import AdminCustomerPicker from "@/components/ui/dashboard/AdminCustomerPicker";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import MediaUploader, { type MediaFile } from "@/components/ui/dashboard/MediaUploader";
import supabase from "@/lib/supabase";
import { uploadMediaFiles } from "@/lib/mediaUpload";
import {
  createAdminProduct,
  getAdminBranchMembers,
  getAdminBranchesWithManagers,
  type CustomerTier,
  type MediaVisibilityPreset,
} from "@/lib/apiClient";
import {
  CUSTOMER_TIER_OPTIONS as MEDIA_CUSTOMER_TIER_OPTIONS,
  PUBLIC_MEDIA_VISIBILITY_PRESETS,
  parseTargetUserIdsInput,
} from "@/lib/mediaVisibility";
import { getAdminActionRestrictionTooltip } from "@/lib/adminAccessControl";
import { setAdminProductsFlash } from "@/lib/dashboardFlash";
import {
  caratsToGrams,
  deriveQuickVisibilityChoices,
  gramsToCarats,
} from "@/lib/adminUiConfig";

type ProductForm = {
  sku: string;
  name: string;
  color: string;
  origin: string;
  description: string;
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
  targetUserIdsInput: string;
  sourceType: string;
  consignmentAgreementId: string;
  consignmentCommissionRate: string;
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

type BranchOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: string;
};

type ManagerOption = {
  id: string;
  label: string;
};

const initialForm: ProductForm = {
  sku: "",
  name: "",
  color: "",
  origin: "",
  description: "",
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
  targetUserIdsInput: "",
  sourceType: "OWNED",
  consignmentAgreementId: "",
  consignmentCommissionRate: "",
  buyPrice: "",
  saleMinPrice: "",
  saleMaxPrice: "",
};

const VISIBILITY_OPTIONS = [
  "PRIVATE",
  "STAFF",
  "PUBLIC",
  "TOP_SHELF",
  "USER_TIER",
  "TARGETED_USER",
];
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
    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700/60 pb-2 mb-4">
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
  const [weightUnit, setWeightUnit] = useState<"g" | "ct">("g");
  const [publicVisibilityPreset, setPublicVisibilityPreset] = useState<PublicMediaVisibilityPreset>("PUBLIC");
  const [publicMinCustomerTier, setPublicMinCustomerTier] = useState<CustomerTier | "">("");
  const [publicTargetUserIdsInput, setPublicTargetUserIdsInput] = useState("");
  const [publicThumbnailFiles, setPublicThumbnailFiles] = useState<MediaFile[]>([]);
  const [publicVideoFiles, setPublicVideoFiles] = useState<MediaFile[]>([]);
  const [publicGalleryFiles, setPublicGalleryFiles] = useState<MediaFile[]>([]);
  const [publicCertificateFiles, setPublicCertificateFiles] = useState<MediaFile[]>([]);
  const [roleVisibilityPreset, setRoleVisibilityPreset] = useState<RoleMediaVisibilityPreset>("ADMIN");
  const [roleMediaFiles, setRoleMediaFiles] = useState<MediaFile[]>([]);
  const [consignmentContractFiles, setConsignmentContractFiles] = useState<MediaFile[]>([]);
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
  const quickVisibilityChoices = useMemo(
    () =>
      deriveQuickVisibilityChoices({
        visibility: form.visibility,
        customerTier: form.minCustomerTier,
      }),
    [form.minCustomerTier, form.visibility],
  );
  const convertedWeight = useMemo(() => {
    const rawWeight = Number(form.weight);
    if (!Number.isFinite(rawWeight) || rawWeight <= 0) {
      return "";
    }

    return weightUnit === "g"
      ? `${gramsToCarats(rawWeight).toFixed(2)} ct`
      : `${caratsToGrams(rawWeight).toFixed(2)} g`;
  }, [form.weight, weightUnit]);
  const roleVisibilityOptions = useMemo(
    () =>
      form.visibility === "PRIVATE"
        ? (["ADMIN"] as RoleMediaVisibilityPreset[])
        : (["ADMIN", "MANAGER", "SALES"] as RoleMediaVisibilityPreset[]),
    [form.visibility],
  );

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
        const members = await getAdminBranchMembers({
          accessToken,
          branchId,
        });

        const dedupe = new Set<string>();
        const managers: ManagerOption[] = [];

        for (const member of members) {
          const isManagerRow = String(member.memberRole || "").toUpperCase() === "MANAGER";
          const user = member.user;
          const userId = user?.id || "";
          const userStatus = String(user?.status || "").toUpperCase();

          if (!isManagerRow || !userId || userStatus !== "ACTIVE" || dedupe.has(userId)) {
            continue;
          }

          managers.push({
            id: userId,
            label: user.displayName || user.email || userId,
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
        const response = await getAdminBranchesWithManagers({
          accessToken,
          limit: 200,
          includeInactive: true,
        });
        const branchRows = response.items.map((branch) => ({
          id: branch.id,
          code: branch.code || "",
          name: branch.name || "Unnamed Branch",
          city: branch.city,
          status: branch.status || "ACTIVE",
        }));

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

  useEffect(() => {
    if (!roleVisibilityOptions.includes(roleVisibilityPreset)) {
      setRoleVisibilityPreset(roleVisibilityOptions[0]);
    }
  }, [roleVisibilityOptions, roleVisibilityPreset]);

  useEffect(() => {
    if (form.visibility === "PUBLIC") {
      setPublicVisibilityPreset("PUBLIC");
      return;
    }

    if (form.visibility === "TOP_SHELF") {
      setPublicVisibilityPreset("TOP_SHELF");
      return;
    }

    if (form.visibility === "USER_TIER") {
      setPublicVisibilityPreset("USER_TIER");
      if (
        form.minCustomerTier === "REGULAR"
        || form.minCustomerTier === "VIP"
        || form.minCustomerTier === "ULTRA_VIP"
      ) {
        setPublicMinCustomerTier(form.minCustomerTier);
      }
      return;
    }

    if (form.visibility === "TARGETED_USER") {
      setPublicVisibilityPreset("TARGETED_USER");
      setPublicTargetUserIdsInput(form.targetUserIdsInput);
      return;
    }

    setPublicVisibilityPreset("PRIVATE");
  }, [form.minCustomerTier, form.targetUserIdsInput, form.visibility]);

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
      const normalizedWeight = parseOptionalNumber(form.weight, "Weight");
      const normalizedLength = parseOptionalNumber(form.length, "Length");
      const normalizedDepth = parseOptionalNumber(form.depth, "Depth");
      const normalizedHeight = parseOptionalNumber(form.height, "Height");
      const consignmentRate = parseOptionalNumber(
        form.consignmentCommissionRate,
        "Consignment commission rate",
      );
      const productTargetUserIds = parseTargetUserIdsInput(form.targetUserIdsInput);
      const publicTargetUserIds = parseTargetUserIdsInput(publicTargetUserIdsInput);

      if (saleMinPrice !== null && saleMaxPrice !== null && saleMaxPrice < saleMinPrice) {
        throw new Error("Maximum sale price must be greater than or equal to minimum sale price.");
      }
      if (
        form.visibility === "USER_TIER"
        && !(
          form.minCustomerTier === "REGULAR"
          || form.minCustomerTier === "VIP"
          || form.minCustomerTier === "ULTRA_VIP"
        )
      ) {
        throw new Error("Select a customer tier for USER_TIER visibility.");
      }
      if (form.visibility === "TARGETED_USER" && productTargetUserIds.length === 0) {
        throw new Error("Provide at least one target user id for TARGETED_USER visibility.");
      }
      if (form.sourceType === "CONSIGNED") {
        if (consignmentRate === null) {
          throw new Error("Consigned products require a consignment commission rate.");
        }
        if (consignmentRate > 100) {
          throw new Error("Consignment commission rate must be between 0 and 100.");
        }
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
            beneficiaryBranchId: row.branchId,
            rate,
            note: row.note.trim() || null,
          };
        }

        if (!row.userId) {
          throw new Error(`Allocation #${index + 1} requires a manager.`);
        }

        return {
          targetType: "USER" as const,
          beneficiaryUserId: row.userId,
          rate,
          note: row.note.trim() || null,
        };
      });

      const totalRate = normalizedAllocations.reduce((sum, row) => sum + row.rate, 0);
      if (totalRate > 100) {
        throw new Error("Total commission allocation rate cannot exceed 100%.");
      }

      ensureMediaUploadMetadata();
      if (
        form.sourceType === "CONSIGNED"
        && consignmentContractFiles.length > 0
        && !form.consignmentAgreementId.trim()
      ) {
        throw new Error("Provide the consignment agreement id before uploading a contract PDF.");
      }
      setLoading(true);

      const accessToken = await getAccessToken();
      const publicUploadOptions = {
        accessToken,
        visibilityPreset: publicVisibilityPreset,
        ...(publicVisibilityPreset === "USER_TIER" && publicMinCustomerTier
          ? { minCustomerTier: publicMinCustomerTier }
          : {}),
        ...(publicVisibilityPreset === "TARGETED_USER"
          ? { targetUserIds: publicTargetUserIds }
          : {}),
      };

      const uploadedThumbnailMedia =
        publicThumbnailFiles.length > 0
          ? await uploadMediaFiles({
              files: publicThumbnailFiles.map((mediaFile) => mediaFile.file),
              slot: "PUBLIC_THUMBNAIL",
              ...publicUploadOptions,
            })
          : [];
      const uploadedFeatureVideoMedia =
        publicVideoFiles.length > 0
          ? await uploadMediaFiles({
              files: publicVideoFiles.map((mediaFile) => mediaFile.file),
              slot: "PUBLIC_FEATURE_VIDEO",
              ...publicUploadOptions,
            })
          : [];
      const uploadedGalleryMedia =
        publicGalleryFiles.length > 0
          ? await uploadMediaFiles({
              files: publicGalleryFiles.map((mediaFile) => mediaFile.file),
              slot: "PUBLIC_GALLERY",
              ...publicUploadOptions,
            })
          : [];
      const uploadedCertificateMedia =
        publicCertificateFiles.length > 0
          ? await uploadMediaFiles({
              files: publicCertificateFiles.map((mediaFile) => mediaFile.file),
              slot: "PUBLIC_CERTIFICATE",
              ...publicUploadOptions,
            })
          : [];
      const uploadedRoleMedia =
        roleMediaFiles.length > 0
          ? await uploadMediaFiles({
              files: roleMediaFiles.map((mediaFile) => mediaFile.file),
              accessToken,
              slot: "ROLE_REFERENCE",
              visibilityPreset: roleVisibilityPreset,
              allowedRoles: [roleVisibilityPreset],
            })
          : [];
      const uploadedConsignmentContract =
        form.sourceType === "CONSIGNED" && consignmentContractFiles.length > 0
          ? await uploadMediaFiles({
              files: consignmentContractFiles.map((mediaFile) => mediaFile.file),
              accessToken,
              consignmentAgreementId: form.consignmentAgreementId.trim(),
              slot: "CONSIGNMENT_CONTRACT",
              visibilityPreset: "ADMIN",
            })
          : [];

      const createResponse = await createAdminProduct({
        accessToken,
        product: {
          sku: form.sku.trim(),
          name: form.name.trim() || null,
          color: form.color.trim() || null,
          origin: form.origin.trim() || null,
          description: form.description.trim() || null,
          buyPrice: form.sourceType === "CONSIGNED" ? null : buyPrice,
          saleMinPrice,
          saleMaxPrice,
          weight:
            normalizedWeight === null
              ? null
              : weightUnit === "g"
                ? normalizedWeight
                : caratsToGrams(normalizedWeight),
          weightUnit: normalizedWeight === null ? null : "GRAM",
          length: normalizedLength,
          depth: normalizedDepth,
          height: normalizedHeight,
          importDate: form.importDate || null,
          importId: form.importId.trim() || null,
          fromCompanyId: form.fromCompanyId.trim() || null,
          visibility: form.visibility,
          tier: form.tier,
          status: form.status,
          minCustomerTier: form.minCustomerTier || null,
          visibilityNote: form.visibilityNote.trim() || null,
          sourceType: form.sourceType,
          consignmentRate: form.sourceType === "CONSIGNED" ? consignmentRate : null,
          consignmentAgreementId:
            form.sourceType === "CONSIGNED" && form.consignmentAgreementId.trim()
              ? form.consignmentAgreementId.trim()
              : null,
          consignmentContractMediaId:
            form.sourceType === "CONSIGNED" ? uploadedConsignmentContract[0]?.id || null : null,
          commissionAllocations: normalizedAllocations,
          ...(form.visibility === "TARGETED_USER" ? { targetUserIds: productTargetUserIds } : {}),
          ...(hasAnyPublicMedia
            ? {
                publicMedia: {
                  thumbnailMediaId: uploadedThumbnailMedia[0]?.id || null,
                  featureVideoMediaId: uploadedFeatureVideoMedia[0]?.id || null,
                  galleryMediaIds: uploadedGalleryMedia.map((media) => media.id),
                  certificateMediaId: uploadedCertificateMedia[0]?.id || null,
                },
              }
            : {}),
          ...(uploadedRoleMedia.length > 0
            ? {
                roleBasedMedia: uploadedRoleMedia.map((media, index) => ({
                  mediaId: media.id,
                  allowedRoles: [roleVisibilityPreset],
                  displayOrder: index,
                })),
              }
            : {}),
        },
      });

      setAdminProductsFlash({
        tone: createResponse.statusCode === 202 ? "info" : "success",
        message:
          createResponse.message
          || (createResponse.statusCode === 202
            ? "Product creation submitted for main admin approval."
            : "Product created."),
      });
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
    "w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Product"
        description="Fill in the details below to add a new product to the catalog."
        action={
          <Link
            href={productsPath}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Back to Products
          </Link>
        }
      />

      {productCreateBlocked && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          {productCreateTooltip}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {lookupError && (
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg text-sm text-amber-700 dark:text-amber-300">
            {lookupError}
          </div>
        )}

        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          Media uploads are created first, then this form sends grouped references through
          `publicMedia`, `roleBasedMedia`, and `consignmentContractMediaId`. A `202` response is
          treated as a successful approval submission.
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Basic Information</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">
                SKU <span className="text-red-500 dark:text-red-400">*</span>
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
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Product name"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Color</label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => updateField("color", e.target.value)}
                placeholder="e.g. Emerald Green"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Origin</label>
              <input
                type="text"
                value={form.origin}
                onChange={(e) => updateField("origin", e.target.value)}
                placeholder="e.g. Myanmar"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={4}
                placeholder="Detailed product description for staff review and future public listing."
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Pricing &amp; Profit Inputs</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {form.sourceType !== "CONSIGNED" ? (
              <div>
                <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Buy Price</label>
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
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                Consigned products do not use buy price. Profit becomes commission on successful sale.
              </div>
            )}
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Sale Min Price</label>
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
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Sale Max Price</label>
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
            {form.sourceType === "CONSIGNED" ? (
              <div>
                <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Commission % Rate</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.consignmentCommissionRate}
                  onChange={(e) => updateField("consignmentCommissionRate", e.target.value)}
                  placeholder="10"
                  className={inputCls}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Commission Allocations</SectionHeading>

          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Split projected commission by branch or manager/admin user.
            </p>
            <button
              type="button"
              onClick={addAllocation}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              + Add Allocation
            </button>
          </div>

          {allocations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
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
                  <div key={row.id} className="rounded-lg border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Allocation #{index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeAllocation(row.id)}
                        className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                      <div className="lg:col-span-2">
                        <label className="block text-[12px] text-gray-700 dark:text-gray-300 mb-1.5">Target</label>
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
                          <label className="block text-[12px] text-gray-700 dark:text-gray-300 mb-1.5">Branch</label>
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
                            <label className="block text-[12px] text-gray-700 dark:text-gray-300 mb-1.5">
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
                            <label className="block text-[12px] text-gray-700 dark:text-gray-300 mb-1.5">Manager</label>
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
                        <label className="block text-[12px] text-gray-700 dark:text-gray-300 mb-1.5">Rate (%)</label>
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
                        <label className="block text-[12px] text-gray-700 dark:text-gray-300 mb-1.5">Note</label>
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
            <span className="text-gray-500 dark:text-gray-400">Total allocated rate: </span>
            <span
              className={
                totalAllocationRate > 100 ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-700 dark:text-gray-300 font-semibold"
              }
            >
              {totalAllocationRate.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Dimensions &amp; Weight</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">
                Weight ({weightUnit})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={form.weight}
                  onChange={(e) => updateField("weight", e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value as "g" | "ct")}
                  className={`${inputCls} max-w-[96px]`}
                >
                  <option value="g">g</option>
                  <option value="ct">ct</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {convertedWeight ? `Equivalent: ${convertedWeight}` : "Supports grams and carats."}
              </p>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Length (mm)</label>
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
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Depth (mm)</label>
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
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Height (mm)</label>
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

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Import Details</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Import Date</label>
              <input
                type="date"
                value={form.importDate}
                onChange={(e) => updateField("importDate", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Import ID</label>
              <input
                type="text"
                value={form.importId}
                onChange={(e) => updateField("importId", e.target.value)}
                placeholder="e.g. IMP-2025-TH-7781"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">From Company ID</label>
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

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Classification &amp; Visibility</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => {
                  const nextVisibility = e.target.value;
                  updateField("visibility", nextVisibility);

                  if (nextVisibility === "PUBLIC" || nextVisibility === "TOP_SHELF") {
                    updateField("minCustomerTier", "");
                    updateField("targetUserIdsInput", "");
                  }

                  if (nextVisibility === "TARGETED_USER") {
                    updateField("minCustomerTier", "");
                  }
                }}
                className={inputCls}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Tier</label>
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
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
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
            {(form.visibility === "PRIVATE" || form.visibility === "STAFF" || form.visibility === "USER_TIER") ? (
              <div>
                <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">
                  Customer Tier
                </label>
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
            ) : null}
            {form.visibility === "TARGETED_USER" ? (
              <div className="sm:col-span-2">
                <AdminCustomerPicker
                  selectedIds={parseTargetUserIdsInput(form.targetUserIdsInput)}
                  onChange={(nextIds) => updateField("targetUserIdsInput", nextIds.join(", "))}
                  getAccessToken={getAccessToken}
                  disabled={loading || productCreateBlocked}
                  label="Target Users"
                  helperText="Pick the exact customer accounts that should be able to view this product."
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Visibility Note</label>
              <input
                type="text"
                value={form.visibilityNote}
                onChange={(e) => updateField("visibilityNote", e.target.value)}
                placeholder="Optional note about visibility restrictions"
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              Quick Visibility From Products Page
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {quickVisibilityChoices.map((choice) => (
                <div
                  key={choice.value}
                  className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {choice.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {choice.helper}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Sourcing</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">Source Type</label>
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
                <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">
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

          {form.sourceType === "CONSIGNED" ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Consignment Agreement Contract
                </p>
                <MediaUploader
                  files={consignmentContractFiles}
                  onChange={setConsignmentContractFiles}
                  maxFiles={1}
                  maxSizeMB={50}
                  maxVideoSizeMB={500}
                  allowedTypes={["PDF"]}
                  helperText="Upload the signed contract PDF. The product payload will keep the agreement id separate and send the uploaded file as `consignmentContractMediaId`."
                />
              </div>

              <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-4 text-sm text-amber-800 dark:text-amber-200">
                Profit analytics for consigned products should calculate commission on successful
                sale instead of buy-versus-sale spread. The visual flow is ready here and will bind
                to the final analytics endpoint later.
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Public Media Upload</SectionHeading>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Public-ready media follows the product visibility flow. Thumbnail and feature video are
            required when customer-facing media is uploaded.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
                <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
                <AdminCustomerPicker
                  selectedIds={parseTargetUserIdsInput(publicTargetUserIdsInput)}
                  onChange={(nextIds) => setPublicTargetUserIdsInput(nextIds.join(", "))}
                  getAccessToken={getAccessToken}
                  disabled={loading || productCreateBlocked}
                  label="Target User IDs"
                  helperText="Choose the customer accounts allowed to view the uploaded public media."
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700/60 p-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Thumbnail Image</p>
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

            <div className="rounded-lg border border-gray-200 dark:border-gray-700/60 p-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Feature Video (Required)</p>
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

            <div className="rounded-lg border border-gray-200 dark:border-gray-700/60 p-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">More Images</p>
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

            <div className="rounded-lg border border-gray-200 dark:border-gray-700/60 p-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Certificate File or Image</p>
              <MediaUploader
                files={publicCertificateFiles}
                onChange={setPublicCertificateFiles}
                maxFiles={1}
                maxSizeMB={50}
                maxVideoSizeMB={500}
                allowedTypes={["IMAGE", "PDF"]}
                helperText="Upload one PDF or certificate image."
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <SectionHeading>Role Based Media Upload</SectionHeading>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Upload internal media and restrict access by staff role. Manager and sales options stay
            disabled while the product itself remains PRIVATE.
          </p>

          <div className="mb-4">
            <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Role Visibility
            </label>
            <select
              value={roleVisibilityPreset}
              onChange={(e) => setRoleVisibilityPreset(e.target.value as RoleMediaVisibilityPreset)}
              className={inputCls}
            >
              {roleVisibilityOptions.map((preset) => (
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
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
