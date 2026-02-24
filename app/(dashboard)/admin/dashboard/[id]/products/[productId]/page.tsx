"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import MediaUploader, { type MediaFile } from "@/components/ui/dashboard/MediaUploader";
import supabase from "@/lib/supabase";
import { uploadMediaFiles } from "@/lib/mediaUpload";

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

type InventoryAnalyticsResponse = {
  inventory?: InventoryProduct[];
};

type InventoryProduct = {
  id: string;
  sku: string;
  name: string | null;
  status: string;
  media?: InventoryProductMediaRef[];
  mediaIds?: string[];
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
};

type ProductMedia = {
  id: string;
  type: "IMAGE" | "VIDEO" | "CERTIFICATE";
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

type AdminMediaUrlResponse = {
  id?: string;
  productId?: string | null;
  type?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  url?: string;
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

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

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

const toDisplayMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  return String(value);
};

const normalizeMediaType = (value: unknown): ProductMedia["type"] | null => {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "IMAGE" || normalized === "VIDEO" || normalized === "CERTIFICATE") {
    return normalized;
  }

  return null;
};

const toProductMedia = (payload: AdminMediaUrlResponse | null): ProductMedia | null => {
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  const type = normalizeMediaType(payload?.type);

  if (!id || !url || !type) {
    return null;
  }

  return {
    id,
    url,
    type,
    mimeType: typeof payload?.mimeType === "string" ? payload.mimeType : null,
    sizeBytes: typeof payload?.sizeBytes === "number" ? payload.sizeBytes : null,
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

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const { dashboardBasePath } = useRole();

  const productId = String(params.productId || "");
  const productsPath = `${dashboardBasePath}/products`;

  const [form, setForm] = useState<EditForm>(initialForm);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [existingMedia, setExistingMedia] = useState<ProductMedia[]>([]);
  const [newMediaFiles, setNewMediaFiles] = useState<MediaFile[]>([]);
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
      const response = await fetch(`/api/v1/admin/media/${encodeURIComponent(mediaId)}/url`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json().catch(() => null)) as
        | AdminMediaUrlResponse
        | ApiErrorPayload
        | null;

      return toProductMedia(payload as AdminMediaUrlResponse | null);
    },
    [],
  );

  const refreshSingleMediaUrl = useCallback(
    async (mediaId: string) => {
      if (!mediaId) {
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
          prev.map((media) => (media.id === mediaId ? { ...media, url: refreshedMedia.url } : media)),
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
      const orderedMediaIds: string[] = [];
      const seenMediaIds = new Set<string>();

      const mediaRefs = Array.isArray(targetProduct.media) ? targetProduct.media : [];
      for (const mediaRef of mediaRefs) {
        const mediaId = typeof mediaRef?.id === "string" ? mediaRef.id.trim() : "";

        if (mediaId && !seenMediaIds.has(mediaId)) {
          seenMediaIds.add(mediaId);
          orderedMediaIds.push(mediaId);
        }
      }

      if (Array.isArray(targetProduct.mediaIds)) {
        for (const mediaId of targetProduct.mediaIds) {
          if (typeof mediaId !== "string" || !mediaId.trim()) {
            continue;
          }

          const normalizedId = mediaId.trim();
          if (!seenMediaIds.has(normalizedId)) {
            seenMediaIds.add(normalizedId);
            orderedMediaIds.push(normalizedId);
          }
        }
      }

      if (orderedMediaIds.length === 0) {
        return {
          media: [] as ProductMedia[],
          hasReferences: false,
        };
      }

      const mediaRows: ProductMedia[] = [];
      for (const mediaId of orderedMediaIds) {
        const media = await fetchAdminMediaById(accessToken, mediaId);

        if (media) {
          mediaRows.push(media);
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

        const [inventoryResponse, branchResponse] = await Promise.all([
          fetch("/api/v1/admin/analytics/inventory-profit?includeSold=true", {
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

        const inventoryPayload = (await inventoryResponse.json().catch(() => null)) as
          | ApiErrorPayload
          | InventoryAnalyticsResponse
          | null;
        const branchPayload = (await branchResponse.json().catch(() => null)) as
          | ApiErrorPayload
          | BranchAnalyticsResponse
          | null;

        if (!inventoryResponse.ok) {
          throw new Error(
            toErrorMessage(
              inventoryPayload as ApiErrorPayload | null,
              "Failed to load product analytics.",
            ),
          );
        }

        if (!branchResponse.ok) {
          throw new Error(
            toErrorMessage(branchPayload as ApiErrorPayload | null, "Failed to load branches."),
          );
        }

        const inventory = Array.isArray((inventoryPayload as InventoryAnalyticsResponse)?.inventory)
          ? ((inventoryPayload as InventoryAnalyticsResponse).inventory as InventoryProduct[])
          : [];

        const targetProduct = inventory.find((item) => item.id === productId) || null;

        if (!targetProduct) {
          setNotFound(true);
          setProduct(null);
          return;
        }

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
        setNewMediaFiles([]);

        const mediaResult = await resolveExistingMediaFromAdmin(accessToken, targetProduct);
        setExistingMedia(mediaResult.media);

        if (!mediaResult.hasReferences) {
          setMediaHint(
            "Existing media cannot be loaded yet because the current admin product analytics payload does not include media references for this product. You can still upload new media below.",
          );
        } else if (!mediaResult.media.length) {
          setMediaHint("No existing media records could be resolved for this product.");
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
        void refreshSingleMediaUrl(media.id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      });

      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "Failed to update product."));
      }

      if (newMediaFiles.length > 0) {
        await uploadMediaFiles({
          files: newMediaFiles.map((item) => item.file),
          accessToken,
          productId: product.id,
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
          <SectionHeading>Media &amp; Documents</SectionHeading>

          {mediaHint && (
            <div className="mb-4 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs">
              {mediaHint}
            </div>
          )}

          {existingMedia.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500 mb-4">
              No existing media found from read endpoint.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              {existingMedia.map((media) => (
                <a
                  key={media.id}
                  href={media.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-200 overflow-hidden bg-white hover:border-gray-300 transition-colors"
                >
                  <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    {media.type === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media.url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => {
                          void refreshSingleMediaUrl(media.id);
                        }}
                      />
                    ) : media.type === "VIDEO" ? (
                      <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
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
                  <div className="px-2 py-2 flex items-center justify-between">
                    <MediaTypeChip type={media.type} />
                    <span className="text-[10px] text-gray-400 font-mono">{media.id.slice(0, 6)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 mb-3">
            Add new media files to this product. The current backend flow supports appending media records.
          </p>
          <MediaUploader
            files={newMediaFiles}
            onChange={setNewMediaFiles}
            maxFiles={10}
            maxSizeMB={50}
            maxVideoSizeMB={500}
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
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
