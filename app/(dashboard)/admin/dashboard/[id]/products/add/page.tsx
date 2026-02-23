"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import MediaUploader, { type MediaFile } from "@/components/ui/dashboard/MediaUploader";
import supabase from "@/lib/supabase";
import { uploadMediaFiles } from "@/lib/mediaUpload";

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
};

const VISIBILITY_OPTIONS = ["PRIVATE", "PUBLIC", "TOP_SHELF", "TARGETED"];
const TIER_OPTIONS = ["STANDARD", "VIP", "ULTRA_RARE"];
const STATUS_OPTIONS = ["AVAILABLE", "PENDING", "BUSY", "SOLD"];
const CUSTOMER_TIER_OPTIONS = ["", "REGULAR", "VIP", "ULTRA_VIP"];
const SOURCE_TYPE_OPTIONS = ["OWNED", "CONSIGNED"];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
      {children}
    </h2>
  );
}

export default function AddProductPage() {
  const router = useRouter();
  const { dashboardBasePath } = useRole();
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const productsPath = `${dashboardBasePath}/products`;

  const updateField = (field: keyof ProductForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.sku.trim()) {
      setError("SKU is required.");
      return;
    }

    setLoading(true);

    try {
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
      };

      let mediaIds: string[] = [];

      if (mediaFiles.length > 0) {
        const uploadedMedia = await uploadMediaFiles({
          files: mediaFiles.map((mf) => mf.file),
          accessToken,
        });

        mediaIds = uploadedMedia.map((media) => media.id);
      }

      const createProductPayload = {
        ...payload,
        mediaIds,
      };

      const createResponse = await fetch("/api/v1/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(createProductPayload),
      });

      const createBody = (await createResponse.json().catch(() => null)) as
        | { message?: string; code?: string; reason?: string }
        | null;

      if (!createResponse.ok) {
        const message = createBody?.message || "Failed to create product.";
        const code = createBody?.code ? ` (code: ${createBody.code})` : "";
        const reason = createBody?.reason ? ` (reason: ${createBody.reason})` : "";

        throw new Error(`${message}${code}${reason}`);
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error banner */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Basic Info */}
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
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Product name"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Color</label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => updateField("color", e.target.value)}
                placeholder="e.g. Emerald Green"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Dimensions & Weight</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Weight (g)</label>
              <input
                type="number"
                step="0.01"
                value={form.weight}
                onChange={(e) => updateField("weight", e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Import Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Import Details</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Import Date</label>
              <input
                type="date"
                value={form.importDate}
                onChange={(e) => updateField("importDate", e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Import ID</label>
              <input
                type="text"
                value={form.importId}
                onChange={(e) => updateField("importId", e.target.value)}
                placeholder="e.g. IMP-2025-TH-7781"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">From Company ID</label>
              <input
                type="text"
                value={form.fromCompanyId}
                onChange={(e) => updateField("fromCompanyId", e.target.value)}
                placeholder="e.g. company-7788"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Classification & Visibility</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => updateField("visibility", e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">
                Min. Customer Tier
              </label>
              <select
                value={form.minCustomerTier}
                onChange={(e) => updateField("minCustomerTier", e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                {CUSTOMER_TIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt || "— None —"}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[13px] text-gray-700 mb-1.5">
                Visibility Note
              </label>
              <input
                type="text"
                value={form.visibilityNote}
                onChange={(e) => updateField("visibilityNote", e.target.value)}
                placeholder="Optional note about visibility restrictions"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Sourcing */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Sourcing</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-1.5">Source Type</label>
              <select
                value={form.sourceType}
                onChange={(e) => updateField("sourceType", e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
                  onChange={(e) =>
                    updateField("consignmentAgreementId", e.target.value)
                  }
                  placeholder="UUID of the consignment agreement"
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            )}
          </div>
        </div>

        {/* Media Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Media &amp; Documents</SectionHeading>
          <p className="text-xs text-gray-500 mb-4">
            Upload product images, videos, and PDF documents (e.g. certificates, appraisals).
            The first image is automatically set as the primary image. Images/PDF are
            limited to 50 MB each, videos to 500 MB.
          </p>
          <MediaUploader
            files={mediaFiles}
            onChange={setMediaFiles}
            maxFiles={10}
            maxSizeMB={50}
            maxVideoSizeMB={500}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={productsPath}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating..." : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
