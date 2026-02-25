"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import MediaUploader, { type MediaFile } from "@/components/ui/dashboard/MediaUploader";
import supabase from "@/lib/supabase";
import { uploadMediaFiles } from "@/lib/mediaUpload";
import {
  type CustomerTier,
  getAdminMediaUrl,
  type AdminMediaUrlResponse,
  type MediaVisibilityPreset,
} from "@/lib/apiClient";
import {
  CUSTOMER_TIER_OPTIONS as MEDIA_CUSTOMER_TIER_OPTIONS,
  PUBLIC_MEDIA_VISIBILITY_PRESETS,
  ROLE_MEDIA_VISIBILITY_PRESETS,
  deriveVisibilityPresetFromMedia,
  isPublicVisibilityPreset,
  isRoleVisibilityPreset,
  parseTargetUserIdsInput,
} from "@/lib/mediaVisibility";
import { getAdminActionRestrictionTooltip } from "@/lib/adminAccessControl";

type ApiErrorPayload = {
  message?: string;
  code?: string;
  reason?: string;
};

type BranchOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: string;
};

type BranchAnalyticsResponse = {
  branches?: BranchOption[];
};

type BranchMember = {
  memberRole?: string;
  user?: {
    id?: string;
    email?: string | null;
    status?: string | null;
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

type AdminProductBeneficiaryUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
  managerProfile?: {
    displayName?: string | null;
  } | null;
  adminProfile?: {
    displayName?: string | null;
  } | null;
};

type AdminProductBeneficiaryBranch = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  city?: string | null;
  status?: string | null;
};

type AdminProductCommissionAllocation = {
  id: string;
  targetType: "BRANCH" | "USER";
  rate: number | string;
  note: string | null;
  beneficiaryUserId?: string | null;
  beneficiaryBranchId?: string | null;
  beneficiaryUser?: AdminProductBeneficiaryUser | null;
  beneficiaryBranch?: AdminProductBeneficiaryBranch | null;
};

type AdminProductMediaRef = {
  id?: string | null;
  type?: string | null;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  visibilitySections?: string[] | null;
  audience?: string | null;
  allowedRoles?: string[] | null;
  minCustomerTier?: string | null;
  visibilityPreset?: string | null;
  targetUsers?: Array<{
    userId?: string | null;
  }> | null;
};

type AdminProductDetail = {
  id: string;
  sku: string;
  name: string | null;
  status: string;
  buyPrice?: number | string | null;
  saleMinPrice?: number | string | null;
  saleMaxPrice?: number | string | null;
  media?: AdminProductMediaRef[] | null;
  commissionAllocations?: AdminProductCommissionAllocation[] | null;
};

type InventoryProduct = {
  id: string;
  sku: string;
  name: string | null;
  status: string;
  media: InventoryProductMediaRef[];
  pricing: {
    buyPrice: number | null;
    saleMinPrice: number | null;
    saleMaxPrice: number | null;
    isComplete: boolean;
  };
  commission: {
    allocationRateTotal: number;
    allocations: InventoryCommissionAllocation[];
  };
};

type InventoryCommissionAllocation = {
  id: string;
  targetType: "BRANCH" | "USER";
  rate: number;
  note: string | null;
  beneficiary: {
    userId: string | null;
    branchId: string | null;
    displayName: string | null;
    userEmail: string | null;
    branchName: string | null;
  };
};

type InventoryProductMediaRef = {
  id?: string;
  type?: string;
  url?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  visibilitySections?: string[] | null;
  audience?: string | null;
  allowedRoles?: string[] | null;
  minCustomerTier?: string | null;
  visibilityPreset?: string | null;
  targetUsers?: Array<{
    userId?: string | null;
  }> | null;
};

type ProductMedia = {
  id: string;
  mediaId: string | null;
  type: "IMAGE" | "VIDEO" | "PDF";
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  visibilityPreset: MediaVisibilityPreset | null;
  audience: string | null;
  minCustomerTier: CustomerTier | null;
  targetUserIds: string[];
};

type EditForm = {
  sku: string;
  name: string;
  status: string;
  buyPrice: string;
  saleMinPrice: string;
  saleMaxPrice: string;
};

type AllocationRow = {
  id: string;
  targetType: "BRANCH" | "USER";
  branchId: string;
  managerBranchId: string;
  userId: string;
  userLabel: string;
  rate: string;
  note: string;
};

const initialForm: EditForm = {
  sku: "",
  name: "",
  status: "",
  buyPrice: "",
  saleMinPrice: "",
  saleMaxPrice: "",
};
type PublicMediaVisibilityPreset = Extract<
  MediaVisibilityPreset,
  "PUBLIC" | "TOP_SHELF" | "USER_TIER" | "TARGETED_USER" | "PRIVATE"
>;
type RoleMediaVisibilityPreset = Extract<MediaVisibilityPreset, "ADMIN" | "MANAGER" | "SALES">;

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const toErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  const message = payload?.message || fallback;
  const code = payload?.code ? ` (code: ${payload.code})` : "";
  const reason = payload?.reason ? ` (reason: ${payload.reason})` : "";

  return `${message}${code}${reason}`;
};

const mediaDeleteEndpoints = (mediaId: string) => [
  `/api/v1/admin/media/${encodeURIComponent(mediaId)}`,
  `/api/v1/media/${encodeURIComponent(mediaId)}`,
];

const formatBranchLabel = (branch: BranchOption) => {
  const code = branch.code ? `${branch.code} - ` : "";
  const city = branch.city ? ` (${branch.city})` : "";
  const status = branch.status !== "ACTIVE" ? ` [${branch.status}]` : "";
  return `${code}${branch.name}${city}${status}`;
};

const parseOptionalMoney = (value: string, fieldLabel: string) => {
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

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

const toDisplayMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  return String(value);
};


const normalizeMediaType = (value: unknown): ProductMedia["type"] | null => {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "CERTIFICATE") {
    return "PDF";
  }

  if (normalized === "IMAGE" || normalized === "VIDEO" || normalized === "PDF") {
    return normalized;
  }

  return null;
};

const normalizeCustomerTier = (value: unknown): CustomerTier | null => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "REGULAR" || normalized === "VIP" || normalized === "ULTRA_VIP") {
    return normalized;
  }

  return null;
};

const extractTargetUserIds = (targetUsers: Array<{ userId?: string | null }> | null | undefined) =>
  [...new Set(
    (Array.isArray(targetUsers) ? targetUsers : [])
      .map((row) => String(row?.userId || "").trim())
      .filter(Boolean),
  )];

const toProductMedia = (payload: AdminMediaUrlResponse | null): ProductMedia | null => {
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  const type = normalizeMediaType(payload?.type);

  if (!id || !url || !type) {
    return null;
  }

  const visibilityPreset = deriveVisibilityPresetFromMedia({
    visibilityPreset: payload?.visibilityPreset || null,
    audience: payload?.audience || null,
    visibilitySections: payload?.visibilitySections || [],
    allowedRoles: payload?.allowedRoles || [],
    minCustomerTier: payload?.minCustomerTier || null,
    targetUsers: payload?.targetUsers || [],
  });

  return {
    id,
    mediaId: id,
    url,
    type,
    mimeType: typeof payload?.mimeType === "string" ? payload.mimeType : null,
    sizeBytes: typeof payload?.sizeBytes === "number" ? payload.sizeBytes : null,
    visibilityPreset,
    audience: payload?.audience ? String(payload.audience).toUpperCase() : null,
    minCustomerTier: normalizeCustomerTier(payload?.minCustomerTier),
    targetUserIds: extractTargetUserIds(payload?.targetUsers),
  };
};

const toInventoryProduct = (payload: AdminProductDetail): InventoryProduct => {
  const buyPrice = toNumberOrNull(payload.buyPrice);
  const saleMinPrice = toNumberOrNull(payload.saleMinPrice);
  const saleMaxPrice = toNumberOrNull(payload.saleMaxPrice);

  const media = (Array.isArray(payload.media) ? payload.media : [])
    .map((mediaRef) => ({
      id: typeof mediaRef?.id === "string" ? mediaRef.id : undefined,
      type: typeof mediaRef?.type === "string" ? mediaRef.type : undefined,
      url: typeof mediaRef?.url === "string" ? mediaRef.url : undefined,
      mimeType: typeof mediaRef?.mimeType === "string" ? mediaRef.mimeType : null,
      sizeBytes: typeof mediaRef?.sizeBytes === "number" ? mediaRef.sizeBytes : null,
      visibilitySections: Array.isArray(mediaRef?.visibilitySections)
        ? mediaRef.visibilitySections
        : null,
      audience: typeof mediaRef?.audience === "string" ? mediaRef.audience : null,
      allowedRoles: Array.isArray(mediaRef?.allowedRoles) ? mediaRef.allowedRoles : null,
      minCustomerTier:
        typeof mediaRef?.minCustomerTier === "string" ? mediaRef.minCustomerTier : null,
      visibilityPreset:
        typeof mediaRef?.visibilityPreset === "string" ? mediaRef.visibilityPreset : null,
      targetUsers: Array.isArray(mediaRef?.targetUsers)
        ? mediaRef.targetUsers
        : null,
    }))
    .filter((mediaRef) =>
      Boolean(
        (typeof mediaRef.id === "string" && mediaRef.id.trim()) ||
          (typeof mediaRef.url === "string" && mediaRef.url.trim()),
      ),
    );

  const allocations = (Array.isArray(payload.commissionAllocations) ? payload.commissionAllocations : [])
    .filter((allocation): allocation is AdminProductCommissionAllocation => {
      return Boolean(
        allocation &&
          typeof allocation === "object" &&
          typeof allocation.id === "string" &&
          allocation.id.trim() &&
          (allocation.targetType === "BRANCH" || allocation.targetType === "USER"),
      );
    })
    .map((allocation) => {
      const normalizedRate = Number(allocation.rate);
      const beneficiaryDisplayName =
        allocation.beneficiaryUser?.managerProfile?.displayName ||
        allocation.beneficiaryUser?.adminProfile?.displayName ||
        allocation.beneficiaryBranch?.name ||
        allocation.beneficiaryUser?.email ||
        null;

      return {
        id: allocation.id,
        targetType: allocation.targetType,
        rate: Number.isFinite(normalizedRate) ? normalizedRate : 0,
        note: allocation.note || null,
        beneficiary: {
          userId: typeof allocation.beneficiaryUserId === "string" ? allocation.beneficiaryUserId : null,
          branchId:
            typeof allocation.beneficiaryBranchId === "string" ? allocation.beneficiaryBranchId : null,
          displayName: beneficiaryDisplayName,
          userEmail:
            typeof allocation.beneficiaryUser?.email === "string"
              ? allocation.beneficiaryUser.email
              : null,
          branchName:
            typeof allocation.beneficiaryBranch?.name === "string"
              ? allocation.beneficiaryBranch.name
              : null,
        },
      } satisfies InventoryCommissionAllocation;
    });

  const allocationRateTotal = allocations.reduce((sum, allocation) => sum + allocation.rate, 0);

  return {
    id: payload.id,
    sku: payload.sku,
    name: payload.name || null,
    status: payload.status,
    media,
    pricing: {
      buyPrice,
      saleMinPrice,
      saleMaxPrice,
      isComplete: buyPrice !== null && saleMinPrice !== null && saleMaxPrice !== null,
    },
    commission: {
      allocationRateTotal,
      allocations,
    },
  };
};

const toInlineProductMedia = (
  mediaRef: InventoryProductMediaRef,
  fallbackIndex: number,
): ProductMedia | null => {
  const mediaUrl = typeof mediaRef.url === "string" ? mediaRef.url.trim() : "";
  if (!mediaUrl) {
    return null;
  }

  const normalizedMimeType =
    typeof mediaRef.mimeType === "string" ? mediaRef.mimeType.trim().toLowerCase() : "";
  const fallbackTypeFromMime = normalizedMimeType.startsWith("image/")
    ? "IMAGE"
    : normalizedMimeType.startsWith("video/")
      ? "VIDEO"
      : normalizedMimeType === "application/pdf"
        ? "PDF"
        : null;
  const mediaType = normalizeMediaType(mediaRef.type) ?? fallbackTypeFromMime;

  if (!mediaType) {
    return null;
  }

  const mediaId = typeof mediaRef.id === "string" && mediaRef.id.trim() ? mediaRef.id.trim() : null;
  const rowId = mediaId || `inline-${fallbackIndex}-${mediaUrl}`;
  const visibilityPreset = deriveVisibilityPresetFromMedia({
    visibilityPreset: mediaRef.visibilityPreset || null,
    audience: mediaRef.audience || null,
    visibilitySections: mediaRef.visibilitySections || [],
    allowedRoles: mediaRef.allowedRoles || [],
    minCustomerTier: mediaRef.minCustomerTier || null,
    targetUsers: mediaRef.targetUsers || [],
  });

  return {
    id: rowId,
    mediaId,
    type: mediaType,
    url: mediaUrl,
    mimeType: normalizedMimeType || null,
    sizeBytes: typeof mediaRef.sizeBytes === "number" ? mediaRef.sizeBytes : null,
    visibilityPreset,
    audience: mediaRef.audience ? String(mediaRef.audience).toUpperCase() : null,
    minCustomerTier: normalizeCustomerTier(mediaRef.minCustomerTier),
    targetUserIds: extractTargetUserIds(mediaRef.targetUsers),
  };
};

const makeNewAllocation = (): AllocationRow => ({
  id: `allocation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  targetType: "BRANCH",
  branchId: "",
  managerBranchId: "",
  userId: "",
  userLabel: "",
  rate: "",
  note: "",
});

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
      {children}
    </h2>
  );
}

function MediaTypeChip({ type }: { type: ProductMedia["type"] }) {
  if (type === "IMAGE") {
    return <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-medium">IMAGE</span>;
  }

  if (type === "VIDEO") {
    return <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-medium">VIDEO</span>;
  }

  return <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-[11px] font-medium">PDF</span>;
}

function VisibilityPresetChip({
  preset,
}: {
  preset: MediaVisibilityPreset | null;
}) {
  if (!preset) {
    return (
      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px] font-medium">
        UNSET
      </span>
    );
  }

  const isRolePreset = isRoleVisibilityPreset(preset);

  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
        isRolePreset ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {preset.replace(/_/g, " ")}
    </span>
  );
}

function ExistingMediaCard({
  media,
  deleting,
  onDelete,
  onRefresh,
}: {
  media: ProductMedia;
  deleting: boolean;
  onDelete: (media: ProductMedia) => void;
  onRefresh: (rowId: string, mediaId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <a href={media.url} target="_blank" rel="noreferrer" className="block">
        <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
          {media.type === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.url}
              alt=""
              className="w-full h-full object-cover"
              onError={() => {
                if (media.mediaId) {
                  onRefresh(media.id, media.mediaId);
                }
              }}
            />
          ) : media.type === "VIDEO" ? (
            <video
              key={media.url}
              src={media.url}
              className="w-full h-full object-cover"
              muted
              autoPlay
              loop
              playsInline
              onError={() => {
                if (media.mediaId) {
                  onRefresh(media.id, media.mediaId);
                }
              }}
            />
          ) : (
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 3h4" />
            </svg>
          )}
        </div>
      </a>

      <div className="px-2 py-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <MediaTypeChip type={media.type} />
          <VisibilityPresetChip preset={media.visibilityPreset} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400 font-mono">
            {media.mediaId ? media.mediaId.slice(0, 8) : "INLINE"}
          </span>
          <button
            type="button"
            onClick={() => onDelete(media)}
            disabled={deleting}
            className="px-2 py-1 text-[11px] rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const { dashboardBasePath, isAdminActionBlocked } = useRole();
  const productEditBlocked = isAdminActionBlocked("PRODUCT_EDIT");
  const productDeleteBlocked = isAdminActionBlocked("PRODUCT_DELETE");
  const productEditTooltip = getAdminActionRestrictionTooltip("PRODUCT_EDIT");
  const productDeleteTooltip = getAdminActionRestrictionTooltip("PRODUCT_DELETE");

  const productId = String(params.productId || "");
  const productsPath = `${dashboardBasePath}/products`;

  const [form, setForm] = useState<EditForm>(initialForm);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [existingMedia, setExistingMedia] = useState<ProductMedia[]>([]);
  const [publicVisibilityPreset, setPublicVisibilityPreset] = useState<PublicMediaVisibilityPreset>("PUBLIC");
  const [publicMinCustomerTier, setPublicMinCustomerTier] = useState<CustomerTier | "">("");
  const [publicTargetUserIdsInput, setPublicTargetUserIdsInput] = useState("");
  const [publicThumbnailFiles, setPublicThumbnailFiles] = useState<MediaFile[]>([]);
  const [publicVideoFiles, setPublicVideoFiles] = useState<MediaFile[]>([]);
  const [publicGalleryFiles, setPublicGalleryFiles] = useState<MediaFile[]>([]);
  const [publicCertificateFiles, setPublicCertificateFiles] = useState<MediaFile[]>([]);
  const [roleVisibilityPreset, setRoleVisibilityPreset] = useState<RoleMediaVisibilityPreset>("ADMIN");
  const [roleMediaFiles, setRoleMediaFiles] = useState<MediaFile[]>([]);
  const [product, setProduct] = useState<InventoryProduct | null>(null);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [managersByBranch, setManagersByBranch] = useState<Record<string, ManagerOption[]>>({});
  const [loadingManagersByBranch, setLoadingManagersByBranch] = useState<Record<string, boolean>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [mediaHint, setMediaHint] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const refreshingMediaIdsRef = useRef<Set<string>>(new Set());

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

  const fetchAdminMediaById = useCallback(
    async (accessToken: string, mediaId: string) => {
      try {
        const payload = await getAdminMediaUrl({
          mediaId,
          accessToken,
        });

        return toProductMedia(payload);
      } catch {
        return null;
      }
    },
    [],
  );

  const refreshSingleMediaUrl = useCallback(
    async (mediaRowId: string, mediaId: string) => {
      if (!mediaId || !mediaRowId) {
        return;
      }

      if (refreshingMediaIdsRef.current.has(mediaId)) {
        return;
      }

      refreshingMediaIdsRef.current.add(mediaId);

      try {
        const accessToken = await getAccessToken();
        const refreshedMedia = await fetchAdminMediaById(accessToken, mediaId);

        if (!refreshedMedia) {
          return;
        }

        setExistingMedia((prev) =>
          prev.map((media) => (media.id === mediaRowId ? { ...media, url: refreshedMedia.url } : media)),
        );
      } catch {
        // Keep current URL; subsequent retries/interval can refresh.
      } finally {
        refreshingMediaIdsRef.current.delete(mediaId);
      }
    },
    [fetchAdminMediaById, getAccessToken],
  );

  const resolveExistingMediaFromAdmin = useCallback(
    async (accessToken: string, targetProduct: InventoryProduct) => {
      const mediaRefs = Array.isArray(targetProduct.media) ? targetProduct.media : [];
      if (mediaRefs.length === 0) {
        return {
          media: [] as ProductMedia[],
          hasReferences: false,
        };
      }

      const mediaRows: ProductMedia[] = [];
      const resolvedKeys = new Set<string>();
      const unresolvedMediaIds = new Set<string>();

      for (const [index, mediaRef] of mediaRefs.entries()) {
        const mediaId = typeof mediaRef?.id === "string" ? mediaRef.id.trim() : "";
        const inlineMedia = toInlineProductMedia(mediaRef, index);

        if (inlineMedia) {
          const inlineKey = inlineMedia.mediaId ? `id:${inlineMedia.mediaId}` : `url:${inlineMedia.url}`;
          if (!resolvedKeys.has(inlineKey)) {
            resolvedKeys.add(inlineKey);
            mediaRows.push(inlineMedia);
          }
          continue;
        }

        if (mediaId) {
          unresolvedMediaIds.add(mediaId);
        }
      }

      for (const mediaId of unresolvedMediaIds) {
        const media = await fetchAdminMediaById(accessToken, mediaId);

        if (media) {
          const resolvedKey = media.mediaId ? `id:${media.mediaId}` : `url:${media.url}`;
          if (!resolvedKeys.has(resolvedKey)) {
            resolvedKeys.add(resolvedKey);
            mediaRows.push(media);
          }
        }
      }

      return {
        media: mediaRows,
        hasReferences: true,
      };
    },
    [fetchAdminMediaById],
  );

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

        const rows = Array.isArray(payload) ? payload : [];

        const dedupe = new Set<string>();
        const managers: ManagerOption[] = [];

        for (const row of rows) {
          const isManager = String(row?.memberRole || "").toUpperCase() === "MANAGER";
          const userId = row?.user?.id || "";
          const userStatus = String(row?.user?.status || "").toUpperCase();

          if (!isManager || !userId || userStatus !== "ACTIVE" || dedupe.has(userId)) {
            continue;
          }

          const label =
            row?.user?.managerProfile?.displayName ||
            row?.user?.salespersonProfile?.displayName ||
            row?.user?.customerProfile?.displayName ||
            row?.user?.email ||
            userId;

          managers.push({
            id: userId,
            label,
          });

          dedupe.add(userId);
        }

        setManagersByBranch((prev) => ({
          ...prev,
          [branchId]: managers,
        }));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load branch managers.";

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
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      setLookupError("");
      setMediaHint("");
      setNotFound(false);

      try {
        const accessToken = await getAccessToken();

        const [productResponse, branchResponse] = await Promise.all([
          fetch(`/api/v1/admin/products/${encodeURIComponent(productId)}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }),
          fetch("/api/v1/admin/analytics/branches", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }),
        ]);

        const productPayload = (await productResponse.json().catch(() => null)) as
          | ApiErrorPayload
          | AdminProductDetail
          | null;
        const branchPayload = (await branchResponse.json().catch(() => null)) as
          | ApiErrorPayload
          | BranchAnalyticsResponse
          | null;

        if (productResponse.status === 404) {
          setNotFound(true);
          setProduct(null);
          setExistingMedia([]);
          return;
        }

        if (!productResponse.ok) {
          throw new Error(
            toErrorMessage(
              productPayload as ApiErrorPayload | null,
              "Failed to load product details.",
            ),
          );
        }

        if (!branchResponse.ok) {
          throw new Error(
            toErrorMessage(branchPayload as ApiErrorPayload | null, "Failed to load branches."),
          );
        }

        const productDetail = productPayload as AdminProductDetail;
        if (!productDetail?.id || !productDetail?.sku) {
          throw new Error("Invalid product payload received from admin endpoint.");
        }
        const targetProduct = toInventoryProduct(productDetail);

        const branchRows = Array.isArray((branchPayload as BranchAnalyticsResponse)?.branches)
          ? ((branchPayload as BranchAnalyticsResponse).branches as BranchOption[])
          : [];

        setBranches(branchRows);
        setProduct(targetProduct);
        setForm({
          sku: targetProduct.sku,
          name: targetProduct.name || "",
          status: targetProduct.status,
          buyPrice: toDisplayMoney(targetProduct.pricing.buyPrice),
          saleMinPrice: toDisplayMoney(targetProduct.pricing.saleMinPrice),
          saleMaxPrice: toDisplayMoney(targetProduct.pricing.saleMaxPrice),
        });

        const nextAllocations = (targetProduct.commission.allocations || []).map((allocation) => ({
          id: `existing-${allocation.id}`,
          targetType: allocation.targetType,
          branchId: allocation.targetType === "BRANCH" ? allocation.beneficiary.branchId || "" : "",
          managerBranchId: "",
          userId: allocation.targetType === "USER" ? allocation.beneficiary.userId || "" : "",
          userLabel:
            allocation.beneficiary.displayName ||
            allocation.beneficiary.userEmail ||
            allocation.beneficiary.userId ||
            "",
          rate: String(allocation.rate),
          note: allocation.note || "",
        }));

        setAllocations(nextAllocations);
        setPublicThumbnailFiles([]);
        setPublicVideoFiles([]);
        setPublicGalleryFiles([]);
        setPublicCertificateFiles([]);
        setPublicVisibilityPreset("PUBLIC");
        setPublicMinCustomerTier("");
        setPublicTargetUserIdsInput("");
        setRoleMediaFiles([]);
        setRoleVisibilityPreset("ADMIN");

        const mediaResult = await resolveExistingMediaFromAdmin(accessToken, targetProduct);
        setExistingMedia(mediaResult.media);

        if (!mediaResult.hasReferences) {
          setMediaHint(
            "No existing media is linked to this product yet. You can upload new media below.",
          );
        } else if (!mediaResult.media.length) {
          setMediaHint("Existing media references were found, but no media URLs could be resolved.");
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load product data.";

        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (!productId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    void bootstrap();
  }, [getAccessToken, productId, resolveExistingMediaFromAdmin]);

  useEffect(() => {
    if (!existingMedia.length) {
      return;
    }

    const interval = window.setInterval(() => {
      for (const media of existingMedia) {
        if (media.mediaId) {
          void refreshSingleMediaUrl(media.id, media.mediaId);
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [existingMedia, refreshSingleMediaUrl]);

  const updateField = (field: keyof EditForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAllocation = (allocationId: string, patch: Partial<AllocationRow>) => {
    setAllocations((prev) =>
      prev.map((row) => (row.id === allocationId ? { ...row, ...patch } : row)),
    );
  };

  const addAllocation = () => {
    setAllocations((prev) => [...prev, makeNewAllocation()]);
  };

  const removeAllocation = (allocationId: string) => {
    setAllocations((prev) => prev.filter((row) => row.id !== allocationId));
  };

  const existingPublicMedia = useMemo(
    () => existingMedia.filter((media) => isPublicVisibilityPreset(media.visibilityPreset)),
    [existingMedia],
  );
  const existingRoleMedia = useMemo(
    () => existingMedia.filter((media) => isRoleVisibilityPreset(media.visibilityPreset)),
    [existingMedia],
  );
  const existingOtherMedia = useMemo(
    () =>
      existingMedia.filter(
        (media) =>
          !isPublicVisibilityPreset(media.visibilityPreset) &&
          !isRoleVisibilityPreset(media.visibilityPreset),
      ),
    [existingMedia],
  );

  const hasAnyPublicMediaUpload =
    publicThumbnailFiles.length > 0 ||
    publicVideoFiles.length > 0 ||
    publicGalleryFiles.length > 0 ||
    publicCertificateFiles.length > 0;
  const hasAnyMediaUpload = hasAnyPublicMediaUpload || roleMediaFiles.length > 0;

  const handleDeleteExistingMedia = async (media: ProductMedia) => {
    if (productEditBlocked) {
      setError(productEditTooltip);
      return;
    }

    const mediaId = media.mediaId || media.id;
    if (!mediaId) {
      return;
    }

    const confirmed = window.confirm("Delete this media file from the product?");
    if (!confirmed) {
      return;
    }

    setError("");
    setDeletingMediaId(mediaId);

    try {
      const accessToken = await getAccessToken();
      let deleted = false;
      let endpointUnsupported = false;

      for (const endpoint of mediaDeleteEndpoints(mediaId)) {
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            reason: "Deleted from product edit page",
          }),
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

        if (response.ok) {
          deleted = true;
          break;
        }

        if (response.status === 404 || response.status === 405) {
          endpointUnsupported = true;
          continue;
        }

        throw new Error(toErrorMessage(payload, "Failed to delete media."));
      }

      if (!deleted) {
        if (endpointUnsupported) {
          throw new Error(
            "Media delete endpoint is not available in the API yet. Add DELETE /api/v1/admin/media/:mediaId or DELETE /api/v1/media/:mediaId.",
          );
        }

        throw new Error("Failed to delete media.");
      }

      setExistingMedia((prev) =>
        prev.filter((row) => (row.mediaId || row.id) !== mediaId),
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to delete media.";
      setError(message);
    } finally {
      setDeletingMediaId(null);
    }
  };

  const ensureMediaUploadMetadata = () => {
    if (!hasAnyMediaUpload) {
      return;
    }

    if (!hasAnyPublicMediaUpload) {
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

    if (productEditBlocked) {
      setError(productEditTooltip);
      return;
    }

    if (!product) {
      setError("Product data is not loaded yet.");
      return;
    }

    try {
      const buyPrice = parseOptionalMoney(form.buyPrice, "Buy price");
      const saleMinPrice = parseOptionalMoney(form.saleMinPrice, "Minimum sale price");
      const saleMaxPrice = parseOptionalMoney(form.saleMaxPrice, "Maximum sale price");

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
      setSaving(true);

      const accessToken = await getAccessToken();

      const response = await fetch(`/api/v1/admin/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sku: form.sku.trim(),
          name: form.name.trim() || null,
          buyPrice,
          saleMinPrice,
          saleMaxPrice,
          commissionAllocations: normalizedAllocations,
        }),
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "Failed to update product."));
      }

      const publicTargetUserIds = parseTargetUserIdsInput(publicTargetUserIdsInput);

      if (hasAnyPublicMediaUpload) {
        const publicFiles = [
          ...publicThumbnailFiles,
          ...publicVideoFiles,
          ...publicGalleryFiles,
          ...publicCertificateFiles,
        ].map((mediaFile) => mediaFile.file);

        await uploadMediaFiles({
          files: publicFiles,
          accessToken,
          productId: product.id,
          visibilityPreset: publicVisibilityPreset,
          ...(publicVisibilityPreset === "USER_TIER" && publicMinCustomerTier
            ? { minCustomerTier: publicMinCustomerTier }
            : {}),
          ...(publicVisibilityPreset === "TARGETED_USER"
            ? { targetUserIds: publicTargetUserIds }
            : {}),
        });
      }

      if (roleMediaFiles.length > 0) {
        await uploadMediaFiles({
          files: roleMediaFiles.map((mediaFile) => mediaFile.file),
          accessToken,
          productId: product.id,
          visibilityPreset: roleVisibilityPreset,
        });
      }

      router.push(productsPath);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update product.";

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Product"
          action={
            <Link
              href={productsPath}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back to Products
            </Link>
          }
        />
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-sm text-gray-500">
          Loading product details...
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Product Not Found"
          action={
            <Link
              href={productsPath}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back to Products
            </Link>
          }
        />
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-sm text-gray-500">
          No product was found for id: <span className="font-mono">{productId}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Product"
        description={form.sku || undefined}
        action={
          <Link
            href={productsPath}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back to Products
          </Link>
        }
      />

      {(productEditBlocked || productDeleteBlocked) && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {productEditBlocked ? productEditTooltip : productDeleteTooltip}
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
          <SectionHeading>Product Summary</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] text-gray-500 mb-1">SKU</label>
              <input type="text" value={form.sku} readOnly className={`${inputCls} text-gray-500`} />
            </div>
            <div>
              <label className="block text-[12px] text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[12px] text-gray-500 mb-1">Status</label>
              <input
                type="text"
                value={form.status}
                readOnly
                className={`${inputCls} text-gray-500`}
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
              Editing this array replaces existing backend allocations for this product.
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
              No allocations configured.
            </div>
          ) : (
            <div className="space-y-3">
              {allocations.map((row, index) => {
                const managers = row.managerBranchId ? managersByBranch[row.managerBranchId] || [] : [];
                const isManagerLoading = row.managerBranchId
                  ? Boolean(loadingManagersByBranch[row.managerBranchId])
                  : false;
                const hasCurrentUserOutsideBranchList =
                  Boolean(row.userId) && !managers.some((manager) => manager.id === row.userId);

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
                            const nextTarget = e.target.value as "BRANCH" | "USER";

                            updateAllocation(row.id, {
                              targetType: nextTarget,
                              branchId: "",
                              managerBranchId: "",
                              userId: "",
                              userLabel: "",
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
                                  userLabel: "",
                                });

                                if (branchId) {
                                  void loadBranchManagers(branchId);
                                }
                              }}
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
                              disabled={(!row.managerBranchId && !row.userId) || isManagerLoading}
                              className={inputCls}
                            >
                              <option value="">Select manager</option>
                              {hasCurrentUserOutsideBranchList && (
                                <option value={row.userId}>{row.userLabel || row.userId} (Current)</option>
                              )}
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
          <SectionHeading>Public Media Upload</SectionHeading>

          {mediaHint && (
            <div className="mb-4 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs">
              {mediaHint}
            </div>
          )}

          <p className="text-xs text-gray-500 mb-4">
            Delete outdated media, then upload replacements using the public visibility preset.
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

          <div className="mb-5">
            <p className="text-[12px] font-medium text-gray-700 mb-2">Existing Public Media</p>
            {existingPublicMedia.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                No public media found.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {existingPublicMedia.map((media) => (
                  <ExistingMediaCard
                    key={media.id}
                    media={media}
                    deleting={productEditBlocked || deletingMediaId === (media.mediaId || media.id)}
                    onDelete={(target) => {
                      void handleDeleteExistingMedia(target);
                    }}
                    onRefresh={(rowId, mediaId) => {
                      void refreshSingleMediaUrl(rowId, mediaId);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {existingOtherMedia.length > 0 && (
            <div className="mb-5">
              <p className="text-[12px] font-medium text-gray-700 mb-2">Existing Media (Unclassified)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {existingOtherMedia.map((media) => (
                  <ExistingMediaCard
                    key={media.id}
                    media={media}
                    deleting={productEditBlocked || deletingMediaId === (media.mediaId || media.id)}
                    onDelete={(target) => {
                      void handleDeleteExistingMedia(target);
                    }}
                    onRefresh={(rowId, mediaId) => {
                      void refreshSingleMediaUrl(rowId, mediaId);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

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
            Upload internal media with access limited to one role preset.
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

          <div className="mb-5">
            <p className="text-[12px] font-medium text-gray-700 mb-2">Existing Role Based Media</p>
            {existingRoleMedia.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                No role-based media found.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {existingRoleMedia.map((media) => (
                  <ExistingMediaCard
                    key={media.id}
                    media={media}
                    deleting={productEditBlocked || deletingMediaId === (media.mediaId || media.id)}
                    onDelete={(target) => {
                      void handleDeleteExistingMedia(target);
                    }}
                    onRefresh={(rowId, mediaId) => {
                      void refreshSingleMediaUrl(rowId, mediaId);
                    }}
                  />
                ))}
              </div>
            )}
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
            disabled={saving || productEditBlocked}
            title={productEditBlocked ? productEditTooltip : undefined}
            className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : productEditBlocked ? "Save Changes (Restricted)" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
