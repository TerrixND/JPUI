"use client";

import { generateCertificateSvg } from "@/utils/data";
import {
  getPublicMediaUrl,
  mapPageContextToMediaSection,
} from "@/lib/apiClient";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PRODUCT_DETAIL_DATA = {
  id: "c3a9e21d-5a88-4d91-b2a1-1122ff778899",
  sku: "JDE-IMP-2025-0002",
  name: "Celestial Jade Phoenix Pendant",
  color: "Deep Emerald",
  weight: 38.2,
  length: 54,
  depth: 10,
  height: 70,
  visibility: "PUBLIC",
  tier: "PREMIUM",
  status: "AVAILABLE",
  minCustomerTier: "REGULAR",
  sourceType: "OWNED",
  isArchived: false,
  createdAt: "2025-02-10T09:10:00.000Z",
  updatedAt: "2025-02-10T09:10:00.000Z",
  media: [
    {
      id: "media-a1",
      type: "IMAGE",
      url: "/images/img1.png",
      isPrimary: true,
      createdAt: "2025-02-10T09:15:00.000Z",
    },
    {
      id: "media-a2",
      type: "IMAGE",
      url: "/images/bracelet.png",
      isPrimary: false,
      createdAt: "2025-02-10T09:16:00.000Z",
    },
    {
      id: "media-a3",
      type: "IMAGE",
      url: "/images/earring.png",
      isPrimary: true,
      createdAt: "2025-02-10T09:15:00.000Z",
    },
    {
      id: "media-a4",
      type: "IMAGE",
      url: "/images/necklace.png",
      isPrimary: false,
      createdAt: "2025-02-10T09:16:00.000Z",
    },
    {
      id: "media-a5",
      type: "VIDEO",
      url: "/videos/hero-2.mp4",
      isPrimary: false,
      createdAt: "2025-02-10T09:17:00.000Z",
    },
    {
      id: "media-a6",
      type: "VIDEO",
      url: "/videos/hero-3.mp4",
      isPrimary: false,
      createdAt: "2025-02-10T09:17:00.000Z",
    },
  ],
  currentOwnership: {
    id: "ownership-company-1",
    ownerId: "Jade Palace Pt Co LTD",
    acquiredAt: "2025-02-10T09:10:00.000Z",
    ownershipType: "INVENTORY",
  },
  authCards: [
    {
      id: "auth-a1",
      serialNumber: "AUTH-PHOENIX-0001",
      issuedAt: "2025-02-10T09:20:00.000Z",
    },
  ],
  certificate: {
    serialNumber: "CERT-JP-2025-PHOENIX-0002",
    registeredAt: "2025-02-10T09:20:00.000Z",
    issuedBy: "Jade Palace Pt Co LTD",
    authenticatedBy: "Dr. S PAW",
    gemGrade: "Grade A — Natural Nephrite",
    origin: "Myanmar, Burma",
    currentHolder: "Jade Palace Pt Co LTD",
    holderStatus: "In Company Inventory",
    holderNote: "This item has not been sold to any customer yet.",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ─── Shared UI ────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    AVAILABLE: "bg-emerald-50 text-emerald-600 border-emerald-200",
    RESERVED: "bg-amber-50 text-amber-600 border-amber-200",
    SOLD: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium tracking-widest uppercase ${styles[status] ?? "bg-stone-100 text-stone-500 border-stone-200"}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status.replace(/_/g, " ")}
    </span>
  );
};

const TierBadge = ({ tier }: { tier: string }) => {
  const styles: Record<string, string> = {
    STANDARD: "text-stone-500 border-stone-300 bg-stone-50",
    PREMIUM: "text-amber-700 border-amber-300 bg-amber-50",
    EXCLUSIVE: "text-violet-700 border-violet-300 bg-violet-50",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-sm border text-xs font-semibold tracking-[0.15em] uppercase ${styles[tier] ?? "text-stone-500 border-stone-300"}`}
    >
      {tier}
    </span>
  );
};

const InfoRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start justify-between py-3 border-b border-stone-100 last:border-0">
    <span className="text-xs tracking-widest uppercase text-stone-500 font-medium">
      {label}
    </span>
    <span className="text-sm text-stone-700 text-right max-w-[60%]">
      {value}
    </span>
  </div>
);

const PLACEHOLDER_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect fill="#f5f5f4" width="600" height="600"/>
    <g opacity="0.25">
      <path d="M300 160 C260 200 220 240 210 290 C200 340 230 380 300 390 C370 380 400 340 390 290 C380 240 340 200 300 160Z" fill="#059669"/>
      <path d="M300 175 C268 210 232 248 222 293 C212 338 238 374 300 384 C362 374 388 338 378 293 C368 248 332 210 300 175Z" fill="#10b981"/>
    </g>
    <text x="300" y="430" text-anchor="middle" font-family="serif" font-size="11" fill="#a8a29e" letter-spacing="3">JADE PHOENIX</text>
  </svg>`);

const PRODUCT_MEDIA_SECTION = mapPageContextToMediaSection("PRODUCT_DETAIL");
const SIGNED_URL_REFRESH_MS = 10 * 60 * 1000;

const looksLikeSignedMediaUrl = (url: string) =>
  /^https?:\/\//i.test(url) &&
  /(?:[?&](x-amz-|token=|signature=|expires=|se=))/i.test(url);

const shouldResolvePublicMediaUrl = (mediaId: string, currentUrl: string) =>
  Boolean(mediaId) &&
  (looksLikeSignedMediaUrl(currentUrl) || !currentUrl.trim());

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "details" | "ownership" | "certificate";

export default function ProductDetailPhoenix() {
  const product = PRODUCT_DETAIL_DATA;
  const primaryMedia =
    product.media.find((m) => m.isPrimary) ?? product.media[0];
  const [activeMedia, setActiveMedia] = useState(primaryMedia);
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [mediaUrlById, setMediaUrlById] = useState<Record<string, string>>({});

  const refreshPublicMediaUrl = useCallback(async (mediaId: string) => {
    const media = product.media.find((item) => item.id === mediaId);

    if (!media || !shouldResolvePublicMediaUrl(media.id, media.url)) {
      return "";
    }

    try {
      const result = await getPublicMediaUrl(mediaId, PRODUCT_MEDIA_SECTION);

      setMediaUrlById((prev) => ({
        ...prev,
        [mediaId]: result.url,
      }));

      return result.url;
    } catch {
      return "";
    }
  }, [product.media]);

  useEffect(() => {
    const refreshableMediaIds = product.media
      .filter((media) => shouldResolvePublicMediaUrl(media.id, media.url))
      .map((media) => media.id);

    if (refreshableMediaIds.length === 0) {
      return;
    }

    const kickoffTimer = window.setTimeout(() => {
      for (const mediaId of refreshableMediaIds) {
        void refreshPublicMediaUrl(mediaId);
      }
    }, 0);

    const timer = window.setInterval(() => {
      for (const mediaId of refreshableMediaIds) {
        void refreshPublicMediaUrl(mediaId);
      }
    }, SIGNED_URL_REFRESH_MS);

    return () => {
      window.clearTimeout(kickoffTimer);
      window.clearInterval(timer);
    };
  }, [product.media, refreshPublicMediaUrl]);

  const activeMediaUrl = mediaUrlById[activeMedia.id] || activeMedia.url;

  const handleOpenCertificate = () => {
    const svgContent = generateCertificateSvg(product);
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="text-black w-full bg-white py-20 lg:py-28">
      <div className="px-6 sm:px-12 lg:px-20">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-10 font-sans">
          <Link
            href="/products"
            className="text-xs text-stone-400 tracking-widest uppercase cursor-pointer hover:text-stone-600 transition-colors"
          >
            Products
          </Link>
          <span className="text-stone-300">/</span>
          <span className="text-xs text-stone-500 tracking-widest uppercase truncate max-w-xs">
            {product.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* ── Media ── */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-gradient-to-br from-stone-100 to-stone-200 rounded-xl overflow-hidden border border-stone-200 group shadow-sm">
              {activeMedia.type === "VIDEO" ? (
                <video
                  key={activeMediaUrl}
                  src={activeMediaUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={() => {
                    void refreshPublicMediaUrl(activeMedia.id);
                  }}
                />
              ) : (
                <img
                  key={activeMediaUrl}
                  src={activeMediaUrl}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    void refreshPublicMediaUrl(activeMedia.id).then((refreshedUrl) => {
                      if (!refreshedUrl) {
                        target.src = PLACEHOLDER_SVG;
                      }
                    });
                  }}
                />
              )}
              <div className="absolute top-4 left-4">
                <StatusBadge status={product.status} />
              </div>
              {activeMedia.type === "VIDEO" && (
                <div className="absolute bottom-4 left-4">
                  <span className="bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded font-sans tracking-widest uppercase">
                    ▶ Video
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {product.media.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMedia(m)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    activeMedia.id === m.id
                      ? "border-emerald-500 ring-2 ring-emerald-500/20"
                      : "border-stone-200 hover:border-stone-400"
                  }`}
                >
                  {m.type === "VIDEO" ? (
                    <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                      <span className="text-stone-400 text-base">▶</span>
                    </div>
                  ) : (
                    <img
                      src={mediaUrlById[m.id] || m.url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        void refreshPublicMediaUrl(m.id).then((refreshedUrl) => {
                          if (refreshedUrl) {
                            return;
                          }

                          el.style.display = "none";
                          if (el.parentElement) {
                            el.parentElement.innerHTML = `<div class="w-full h-full bg-emerald-50 flex items-center justify-center"><span class="text-emerald-400 text-xs font-sans">IMG</span></div>`;
                          }
                        });
                      }}
                    />
                  )}
                  {m.isPrimary && (
                    <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Info ── */}
          <div className="space-y-8">
            <h2 className="text-4xl font-md leading-tight text-stone-800">
              {product.name}
            </h2>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
              <p className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-5 font-sans font-medium">
                Physical Properties
              </p>
              <div className="grid grid-cols-4 gap-3 text-center divide-x divide-stone-200">
                {[
                  { label: "Weight", value: `${product.weight}g` },
                  { label: "Length", value: `${product.length}mm` },
                  { label: "Height", value: `${product.height}mm` },
                  { label: "Depth", value: `${product.depth}mm` },
                ].map((d) => (
                  <div key={d.label} className="space-y-1 px-2">
                    <div className="text-xl text-stone-700">{d.value}</div>
                    <div className="text-[10px] text-stone-500 font-sans tracking-[0.15em] uppercase">
                      {d.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex border-b border-stone-200 font-sans mb-6">
                {(["details", "ownership", "certificate"] as Tab[]).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2.5 text-xs tracking-widest uppercase transition-all border-b-2 -mb-px ${
                        activeTab === tab
                          ? "text-emerald-600 border-emerald-500"
                          : "text-stone-500 border-transparent hover:text-stone-600"
                      }`}
                    >
                      {tab}
                    </button>
                  ),
                )}
              </div>

              {activeTab === "details" && (
                <div>
                  <InfoRow
                    label="SKU"
                    value={
                      <span className="font-mono text-xs">{product.sku}</span>
                    }
                  />
                  <InfoRow
                    label="Status"
                    value={<StatusBadge status={product.status} />}
                  />
                  <InfoRow
                    label="Tier"
                    value={<TierBadge tier={product.tier} />}
                  />
                  <InfoRow label="Source" value={product.sourceType} />
                  <InfoRow label="Color" value={product.color} />
                </div>
              )}

              {activeTab === "ownership" && (
                <div className="space-y-4">
                  {product.currentOwnership ? (
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
                      <p className="text-xs tracking-widest uppercase text-stone-400 font-sans mb-4 font-medium">
                        Current Owner
                      </p>
                      <InfoRow
                        label="Owner"
                        value={
                          <span className="font-mono text-xs">
                            {product.currentOwnership.ownerId}
                          </span>
                        }
                      />
                      <InfoRow
                        label="Acquired"
                        value={formatDateShort(
                          product.currentOwnership.acquiredAt,
                        )}
                      />
                    </div>
                  ) : (
                    <p className="text-stone-400 text-sm font-sans">
                      No current owner on record.
                    </p>
                  )}
                </div>
              )}

              {activeTab === "certificate" && (
                <div className="space-y-4">
                  {/* Clickable file card */}
                  <button
                    onClick={handleOpenCertificate}
                    className="w-full group text-left rounded-xl border border-stone-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/30 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Document icon */}
                      <div className="flex-shrink-0 w-10 h-12 bg-stone-100 group-hover:bg-emerald-100 rounded-lg flex flex-col items-center justify-center transition-colors relative">
                        {/* Folded corner */}
                        <div
                          className="absolute top-0 right-0 w-3 h-3 bg-white"
                          style={{
                            clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                          }}
                        />
                        <svg
                          className="w-5 h-5 text-emerald-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.75 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                          />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800">
                          Certificate of Authenticity
                        </p>
                        <p className="text-xs text-stone-400 font-mono mt-0.5 truncate">
                          {product.certificate.serialNumber}
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="flex-shrink-0 text-stone-300 group-hover:text-emerald-500 transition-colors">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="border-t border-stone-100 bg-stone-50 group-hover:bg-emerald-50/50 px-4 py-2 flex justify-between transition-colors">
                      <span className="text-[10px] text-stone-400 font-sans tracking-wide">
                        Click to open in new tab
                      </span>
                      <span className="text-[10px] text-stone-400 font-sans">
                        {formatDateShort(product.certificate.registeredAt)}
                      </span>
                    </div>
                  </button>

                  {/* Summary */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
                    <InfoRow
                      label="Certificate No."
                      value={
                        <span className="font-mono text-xs">
                          {product.certificate.serialNumber}
                        </span>
                      }
                    />
                    <InfoRow
                      label="Issued By"
                      value={product.certificate.issuedBy}
                    />
                    <InfoRow
                      label="Authenticated By"
                      value={product.certificate.authenticatedBy}
                    />
                    <InfoRow
                      label="Registered On"
                      value={formatDateShort(product.certificate.registeredAt)}
                    />
                    {/* <InfoRow
                      label="Item Status"
                      value={
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          In Company Inventory
                        </span>
                      }
                    /> */}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button className="flex-1 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs tracking-[0.2em] uppercase py-3.5 rounded-lg transition-colors font-sans font-semibold shadow-sm">
                Reserve Item
              </button>
              <button className="flex-1 border border-stone-200 hover:border-stone-400 text-stone-500 hover:text-stone-700 text-xs tracking-[0.2em] uppercase py-3.5 rounded-lg transition-colors font-sans font-semibold">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
