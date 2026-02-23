"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import MediaUploader, {
  type MediaFile,
} from "@/components/ui/dashboard/MediaUploader";
import { ADMIN_PRODUCTS, type AdminProduct, type AdminProductMedia } from "@/utils/data";

/* ------------------------------------------------------------------ */
/*  Shared constants (same as add page)                                */
/* ------------------------------------------------------------------ */

const VISIBILITY_OPTIONS = ["PUBLIC", "PRIVATE", "RESTRICTED"];
const TIER_OPTIONS = ["STANDARD", "PREMIUM", "EXCLUSIVE"];
const STATUS_OPTIONS = ["AVAILABLE", "RESERVED", "SOLD", "TRANSFER_PENDING"];
const CUSTOMER_TIER_OPTIONS = ["", "REGULAR", "VIP", "ELITE"];
const SOURCE_TYPE_OPTIONS = ["OWNED", "CONSIGNMENT"];

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                      */
/* ------------------------------------------------------------------ */

const statusColor: Record<string, string> = {
  AVAILABLE: "bg-green-50 text-green-700",
  RESERVED: "bg-amber-50 text-amber-700",
  SOLD: "bg-gray-100 text-gray-600",
  TRANSFER_PENDING: "bg-blue-50 text-blue-700",
};

const tierColor: Record<string, string> = {
  STANDARD: "bg-gray-100 text-gray-600",
  PREMIUM: "bg-purple-50 text-purple-700",
  EXCLUSIVE: "bg-amber-50 text-amber-700",
};

const visColor: Record<string, string> = {
  PUBLIC: "bg-green-50 text-green-700",
  PRIVATE: "bg-gray-100 text-gray-600",
  RESTRICTED: "bg-red-50 text-red-600",
};

function Badge({ label, map }: { label: string; map: Record<string, string> }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${map[label] ?? "bg-gray-100 text-gray-600"}`}
    >
      {label.replace("_", " ")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-800">{children || <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Media gallery icons                                                */
/* ------------------------------------------------------------------ */

function VideoOverlay() {
  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  );
}

function PdfOverlay() {
  return (
    <div className="absolute inset-0 bg-orange-50 flex flex-col items-center justify-center">
      <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 3h4" />
      </svg>
      <span className="text-[10px] font-medium text-orange-600 mt-1">PDF</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit form types                                                    */
/* ------------------------------------------------------------------ */

type EditForm = {
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

function productToForm(p: AdminProduct): EditForm {
  return {
    sku: p.sku,
    name: p.name ?? "",
    color: p.color ?? "",
    weight: p.weight != null ? String(p.weight) : "",
    length: p.length != null ? String(p.length) : "",
    depth: p.depth != null ? String(p.depth) : "",
    height: p.height != null ? String(p.height) : "",
    importDate: p.importDate ? p.importDate.slice(0, 10) : "",
    importId: p.importId ?? "",
    fromCompanyId: p.fromCompanyId ?? "",
    visibility: p.visibility,
    visibilityNote: p.visibilityNote ?? "",
    tier: p.tier,
    status: p.status,
    minCustomerTier: p.minCustomerTier ?? "",
    sourceType: p.sourceType,
    consignmentAgreementId: p.consignmentAgreementId ?? "",
  };
}

/* ------------------------------------------------------------------ */
/*  Existing media → MediaFile adapter (url-based, no real File)       */
/* ------------------------------------------------------------------ */

function existingMediaToFiles(media: AdminProductMedia[]): MediaFile[] {
  return media.map((m) => ({
    id: m.id,
    file: new File([], m.url.split("/").pop() ?? "file", { type: "application/octet-stream" }),
    type: m.type === "IMAGE" ? "IMAGE" : m.type === "VIDEO" ? "VIDEO" : "PDF",
    preview: m.type === "IMAGE" ? m.url : "",
    isPrimary: m.isPrimary,
  }));
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ProductDetailPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const productId = params.productId as string;

  const product = useMemo(
    () => ADMIN_PRODUCTS.find((p) => p.id === productId) ?? null,
    [productId],
  );

  const productsPath = `${dashboardBasePath}/products`;

  /* ---- edit mode ---- */
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(() =>
    product ? productToForm(product) : ({} as EditForm),
  );
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(() =>
    product ? existingMediaToFiles(product.media) : [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field: keyof EditForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleStartEdit = () => {
    if (product) {
      setForm(productToForm(product));
      setMediaFiles(existingMediaToFiles(product.media));
    }
    setError("");
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.sku.trim()) {
      setError("SKU is required.");
      return;
    }

    setSaving(true);
    try {
      // TODO: Replace with actual API call — PATCH /admin/products/:id
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
          form.sourceType === "CONSIGNMENT" && form.consignmentAgreementId.trim()
            ? form.consignmentAgreementId.trim()
            : null,
      };

      const mediaPayload = mediaFiles.map((mf) => ({
        id: mf.id,
        file: mf.file,
        type: mf.type,
        isPrimary: mf.isPrimary,
      }));

      console.log("Update payload:", payload);
      console.log("Media files:", mediaPayload);

      await new Promise((r) => setTimeout(r, 600));

      setEditing(false);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* ---- Not found ---- */
  if (!product) {
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
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">
            No product found with ID <span className="font-mono text-xs">{productId}</span>
          </p>
        </div>
      </div>
    );
  }

  /* ---- helpers for view mode ---- */
  const primaryImage = product.media.find((m) => m.isPrimary && m.type === "IMAGE");
  const fallbackImage = product.media.find((m) => m.type === "IMAGE");
  const heroImage = primaryImage ?? fallbackImage;

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

  /* ================================================================ */
  /*  EDIT MODE                                                        */
  /* ================================================================ */
  if (editing) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Product"
          description={product.sku}
          action={
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          }
        />

        <form onSubmit={handleSave} className="space-y-6">
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
                <input type="text" value={form.sku} onChange={(e) => updateField("sku", e.target.value)} placeholder="e.g. JDE-IMP-2025-0001" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Product name" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Color</label>
                <input type="text" value={form.color} onChange={(e) => updateField("color", e.target.value)} placeholder="e.g. Emerald Green" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeading>Dimensions &amp; Weight</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Weight (g)</label>
                <input type="number" step="0.01" value={form.weight} onChange={(e) => updateField("weight", e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Length (mm)</label>
                <input type="number" step="0.01" value={form.length} onChange={(e) => updateField("length", e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Depth (mm)</label>
                <input type="number" step="0.01" value={form.depth} onChange={(e) => updateField("depth", e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Height (mm)</label>
                <input type="number" step="0.01" value={form.height} onChange={(e) => updateField("height", e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Import */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeading>Import Details</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Import Date</label>
                <input type="date" value={form.importDate} onChange={(e) => updateField("importDate", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Import ID</label>
                <input type="text" value={form.importId} onChange={(e) => updateField("importId", e.target.value)} placeholder="e.g. IMP-2025-TH-7781" className={inputCls} />
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">From Company ID</label>
                <input type="text" value={form.fromCompanyId} onChange={(e) => updateField("fromCompanyId", e.target.value)} placeholder="e.g. company-7788" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeading>Classification &amp; Visibility</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Visibility</label>
                <select value={form.visibility} onChange={(e) => updateField("visibility", e.target.value)} className={inputCls}>
                  {VISIBILITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Tier</label>
                <select value={form.tier} onChange={(e) => updateField("tier", e.target.value)} className={inputCls}>
                  {TIER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className={inputCls}>
                  {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Min. Customer Tier</label>
                <select value={form.minCustomerTier} onChange={(e) => updateField("minCustomerTier", e.target.value)} className={inputCls}>
                  {CUSTOMER_TIER_OPTIONS.map((o) => <option key={o} value={o}>{o || "— None —"}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[13px] text-gray-700 mb-1.5">Visibility Note</label>
                <input type="text" value={form.visibilityNote} onChange={(e) => updateField("visibilityNote", e.target.value)} placeholder="Optional note" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Sourcing */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeading>Sourcing</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] text-gray-700 mb-1.5">Source Type</label>
                <select value={form.sourceType} onChange={(e) => updateField("sourceType", e.target.value)} className={inputCls}>
                  {SOURCE_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {form.sourceType === "CONSIGNMENT" && (
                <div>
                  <label className="block text-[13px] text-gray-700 mb-1.5">Consignment Agreement ID</label>
                  <input type="text" value={form.consignmentAgreementId} onChange={(e) => updateField("consignmentAgreementId", e.target.value)} placeholder="UUID" className={inputCls} />
                </div>
              )}
            </div>
          </div>

          {/* Media */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeading>Media &amp; Documents</SectionHeading>
            <p className="text-xs text-gray-500 mb-4">
              Add or remove images, videos, and PDF documents. The first image is automatically set as primary.
            </p>
            <MediaUploader files={mediaFiles} onChange={setMediaFiles} maxFiles={10} maxSizeMB={50} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={handleCancelEdit} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ================================================================ */
  /*  VIEW MODE                                                        */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name ?? product.sku}
        description={product.name ? product.sku : undefined}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={productsPath}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back
            </Link>
            <button
              onClick={handleStartEdit}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Edit Product
            </button>
          </div>
        }
      />

      {/* Hero + quick info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hero image */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
              {heroImage ? (
                <Image
                  src={heroImage.url}
                  alt={product.name ?? product.sku}
                  fill
                  className="object-cover"
                />
              ) : (
                <svg className="w-16 h-16 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Quick info */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Overview</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="SKU">
              <span className="font-mono text-xs">{product.sku}</span>
            </Field>
            <Field label="Color">{product.color}</Field>
            <Field label="Status"><Badge label={product.status} map={statusColor} /></Field>
            <Field label="Tier"><Badge label={product.tier} map={tierColor} /></Field>
            <Field label="Visibility"><Badge label={product.visibility} map={visColor} /></Field>
            <Field label="Source">
              {product.sourceType === "CONSIGNMENT" ? (
                <span className="text-amber-600 font-medium text-xs">Consignment</span>
              ) : (
                "Owned"
              )}
            </Field>
            <Field label="Min. Customer Tier">{product.minCustomerTier}</Field>
            {product.visibilityNote && (
              <div className="col-span-2 sm:col-span-3">
                <Field label="Visibility Note">{product.visibilityNote}</Field>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <SectionHeading>Dimensions &amp; Weight</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
          <Field label="Weight">{product.weight != null ? `${product.weight} g` : null}</Field>
          <Field label="Length">{product.length != null ? `${product.length} mm` : null}</Field>
          <Field label="Depth">{product.depth != null ? `${product.depth} mm` : null}</Field>
          <Field label="Height">{product.height != null ? `${product.height} mm` : null}</Field>
        </div>
      </div>

      {/* Import details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <SectionHeading>Import Details</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Import Date">
            {product.importDate
              ? new Date(product.importDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null}
          </Field>
          <Field label="Import ID">{product.importId}</Field>
          <Field label="From Company">{product.fromCompanyId}</Field>
        </div>
      </div>

      {/* Sourcing */}
      {product.sourceType === "CONSIGNMENT" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeading>Consignment</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Source Type">{product.sourceType}</Field>
            <Field label="Agreement ID">
              <span className="font-mono text-xs">{product.consignmentAgreementId}</span>
            </Field>
          </div>
        </div>
      )}

      {/* Media gallery */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeading>Media &amp; Documents</SectionHeading>
        </div>

        {product.media.length === 0 ? (
          <div className="text-center py-10">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-400">No media files yet.</p>
            <button
              onClick={handleStartEdit}
              className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Add media
            </button>
          </div>
        ) : (
          <>
            {/* Counters */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-4">
              <span className="font-medium text-gray-700">
                {product.media.length} file{product.media.length !== 1 && "s"}
              </span>
              {product.media.filter((m) => m.type === "IMAGE").length > 0 && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                  {product.media.filter((m) => m.type === "IMAGE").length} image{product.media.filter((m) => m.type === "IMAGE").length !== 1 && "s"}
                </span>
              )}
              {product.media.filter((m) => m.type === "VIDEO").length > 0 && (
                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                  {product.media.filter((m) => m.type === "VIDEO").length} video{product.media.filter((m) => m.type === "VIDEO").length !== 1 && "s"}
                </span>
              )}
              {product.media.filter((m) => m.type === "PDF").length > 0 && (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full">
                  {product.media.filter((m) => m.type === "PDF").length} PDF{product.media.filter((m) => m.type === "PDF").length !== 1 && "s"}
                </span>
              )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {product.media.map((m) => (
                <div
                  key={m.id}
                  className="relative aspect-square rounded-lg bg-gray-100 overflow-hidden border border-gray-200"
                >
                  {m.type === "IMAGE" ? (
                    <Image src={m.url} alt="" fill className="object-cover" />
                  ) : m.type === "VIDEO" ? (
                    <>
                      <div className="w-full h-full bg-gray-800" />
                      <VideoOverlay />
                    </>
                  ) : (
                    <PdfOverlay />
                  )}

                  {/* Primary badge */}
                  {m.isPrimary && (
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-semibold rounded">
                      Primary
                    </span>
                  )}

                  {/* Type chip */}
                  <span
                    className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      m.type === "IMAGE"
                        ? "bg-blue-600 text-white"
                        : m.type === "VIDEO"
                          ? "bg-purple-600 text-white"
                          : "bg-orange-500 text-white"
                    }`}
                  >
                    {m.type}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <SectionHeading>Metadata</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
          <Field label="Created">
            {new Date(product.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Field>
          <Field label="Updated">
            {new Date(product.updatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Field>
          <Field label="Submitted By">
            <span className="font-mono text-xs">{product.submittedByUserId}</span>
          </Field>
          <Field label="Updated By">
            <span className="font-mono text-xs">{product.updatedByUserId}</span>
          </Field>
        </div>
      </div>
    </div>
  );
}
