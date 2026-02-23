"use client";

import Link from "next/link";
import Image from "next/image";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import { ADMIN_PRODUCTS } from "@/utils/data";

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                      */
/* ------------------------------------------------------------------ */

function statusBadge(status: string) {
  switch (status) {
    case "AVAILABLE":        return "bg-green-50 text-green-700";
    case "RESERVED":         return "bg-amber-50 text-amber-700";
    case "SOLD":             return "bg-gray-100 text-gray-600";
    case "TRANSFER_PENDING": return "bg-blue-50 text-blue-700";
    default:                 return "bg-gray-100 text-gray-600";
  }
}

function tierBadge(tier: string) {
  switch (tier) {
    case "STANDARD":  return "bg-gray-100 text-gray-600";
    case "PREMIUM":   return "bg-purple-50 text-purple-700";
    case "EXCLUSIVE":  return "bg-amber-50 text-amber-700";
    default:          return "bg-gray-100 text-gray-600";
  }
}

function visibilityBadge(vis: string) {
  switch (vis) {
    case "PUBLIC":     return "bg-green-50 text-green-700";
    case "PRIVATE":    return "bg-gray-100 text-gray-600";
    case "RESTRICTED": return "bg-red-50 text-red-600";
    default:           return "bg-gray-100 text-gray-600";
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminProducts() {
  const { dashboardBasePath } = useRole();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Create, update, and manage the product catalog."
        action={
          <Link
            href={`${dashboardBasePath}/products/add`}
            className="inline-block px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            + New Product
          </Link>
        }
      />

      {/* API reference */}
      <div className="flex flex-wrap gap-2">
        {[
          "POST /admin/products",
          "PATCH /admin/products/:id",
          "PATCH /admin/products/:id/status",
        ].map((ep) => (
          <span
            key={ep}
            className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md"
          >
            {ep}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Tier</th>
                <th className="px-5 py-3 font-medium">Visibility</th>
                <th className="px-5 py-3 font-medium">Media</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_PRODUCTS.map((p) => {
                const primaryImage = p.media.find((m) => m.isPrimary && m.type === "IMAGE");
                const fallbackImage = p.media.find((m) => m.type === "IMAGE");
                const displayImage = primaryImage ?? fallbackImage;

                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    {/* Product — image + name + color */}
                    <td className="px-5 py-3">
                      <Link
                        href={`${dashboardBasePath}/products/${p.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                          {displayImage ? (
                            <Image
                              src={displayImage.url}
                              alt={p.name ?? p.sku}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
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
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                            {p.name ?? "Unnamed"}
                          </p>
                          {p.color && (
                            <p className="text-xs text-gray-400 truncate">{p.color}</p>
                          )}
                        </div>
                      </Link>
                    </td>

                    {/* SKU */}
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">
                      {p.sku}
                    </td>

                    {/* Tier */}
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${tierBadge(p.tier)}`}
                      >
                        {p.tier}
                      </span>
                    </td>

                    {/* Visibility */}
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${visibilityBadge(p.visibility)}`}
                      >
                        {p.visibility}
                      </span>
                    </td>

                    {/* Media count */}
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {p.media.length > 0 ? (
                        <span>
                          {p.media.filter((m) => m.type === "IMAGE").length > 0 && (
                            <span className="text-blue-600">
                              {p.media.filter((m) => m.type === "IMAGE").length} img
                            </span>
                          )}
                          {p.media.filter((m) => m.type === "VIDEO").length > 0 && (
                            <span className="text-purple-600 ml-1.5">
                              {p.media.filter((m) => m.type === "VIDEO").length} vid
                            </span>
                          )}
                          {p.media.filter((m) => m.type === "PDF").length > 0 && (
                            <span className="text-orange-600 ml-1.5">
                              {p.media.filter((m) => m.type === "PDF").length} pdf
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">No media</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusBadge(p.status)}`}
                      >
                        {p.status.replace("_", " ")}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {p.sourceType === "CONSIGNMENT" ? (
                        <span className="text-amber-600">Consignment</span>
                      ) : (
                        <span>Owned</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
