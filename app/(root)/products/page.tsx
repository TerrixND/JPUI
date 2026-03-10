"use client";

import {
  ApiClientError,
  getPublicProducts,
  type PublicProductRecord,
} from "@/lib/apiClient";
import { isVisibleOnPublicProductPage } from "@/lib/mediaVisibility";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type CatalogProduct = {
  id: string;
  name: string;
  image: string;
  popularity: number;
  createdAt: number;
  finish: "polished" | "raw";
};

const ITEMS_PER_PAGE = 16;
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
    <rect width="600" height="800" fill="#f5f5f4"/>
    <circle cx="300" cy="300" r="120" fill="#d6d3d1"/>
    <rect x="180" y="500" width="240" height="24" rx="12" fill="#d6d3d1"/>
  </svg>`);

const isSignedMediaUrl = (url: string) =>
  /^https?:\/\//i.test(url) &&
  /(?:[?&](x-amz-|token=|signature=|expires=|se=))/i.test(url);

const isRemoteMediaUrl = (url: string) => /^https?:\/\//i.test(url);

const toEpochTime = (value: string | null) => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const deriveFinish = (product: PublicProductRecord): "polished" | "raw" => {
  const descriptor = `${product.cutAndShape || ""} ${product.description || ""}`.toLowerCase();
  return descriptor.includes("raw") ? "raw" : "polished";
};

const resolveCardImage = (product: PublicProductRecord) => {
  const media = (Array.isArray(product.media) ? product.media : []).filter((entry) =>
    isVisibleOnPublicProductPage(entry),
  );
  const preferredImage =
    media.find((entry) => (entry.type || "").toUpperCase() === "IMAGE" && entry.url) ||
    media.find((entry) => Boolean(entry.url));

  const resolved = preferredImage?.url?.trim() || "";
  return resolved || PLACEHOLDER_IMAGE;
};

const ProductPage = () => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isDisposed = false;

    const loadProducts = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await getPublicProducts();
        if (isDisposed) {
          return;
        }

        const nextProducts = response.items.map((item) => ({
          id: item.id,
          name: item.name || item.sku || "Unnamed Product",
          image: resolveCardImage(item),
          popularity: item.accessListUserIds.length,
          createdAt: toEpochTime(item.createdAt || item.updatedAt),
          finish: deriveFinish(item),
        }));

        setProducts(nextProducts);
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setProducts([]);
        setLoadError(
          error instanceof ApiClientError || error instanceof Error
            ? error.message
            : "Failed to load products.",
        );
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    };

    void loadProducts();

    return () => {
      isDisposed = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    let items = [...products];

    if (search.trim() !== "") {
      items = items.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    }

    switch (sort) {
      case "Most Asked":
        items.sort((a, b) => b.popularity - a.popularity || b.createdAt - a.createdAt);
        break;
      case "Latest Items":
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "Polished":
        items = items.filter((p) => p.finish === "polished");
        break;
      case "Raw Stone":
        items = items.filter((p) => p.finish === "raw");
        break;
      default:
        break;
    }

    return items;
  }, [products, search, sort]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, totalPages || 1);

  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, safePage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (
        let i = Math.max(2, safePage - 1);
        i <= Math.min(totalPages - 1, safePage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="w-full bg-white py-10 overflow-hidden">
      <div className="px-6 sm:px-12 lg:px-20 relative py-16">
        <div className="top-0 z-40 bg-white">
          <div className="mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-2xl lg:text-4xl font-light tracking-tight text-neutral-900">
                Collection
              </h2>
              <p className="text-sm text-neutral-500 mt-2 tracking-wide">
                Rare · Refined · Remarkable
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <input
                type="text"
                placeholder="Search products"
                className="w-full sm:w-72 border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                value={search}
                onChange={handleSearchChange}
              />
              <select
                className="border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                value={sort}
                onChange={handleSortChange}
              >
                <option value="">Sort By</option>
                <option value="Most Asked">Most Asked</option>
                <option value="Latest Items">Latest Items</option>
                <option value="Polished">Polished</option>
                <option value="Raw Stone">Raw Stone</option>
              </select>
            </div>
          </div>
        </div>

        {search.trim() !== "" && !isLoading && (
          <div className="mt-8 text-sm text-neutral-500">
            {filteredProducts.length} products
          </div>
        )}

        {isLoading ? (
          <div className="mt-10 text-sm text-neutral-500">Loading products...</div>
        ) : loadError ? (
          <div className="mt-10 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="mt-10 text-sm text-neutral-500">No products found.</div>
        ) : (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-14">
            {paginatedProducts.map((product) => (
              <Link
                href={`/products/${product.id}`}
                key={product.id}
                className="group cursor-pointer"
              >
                <div className="relative aspect-3/4 overflow-hidden bg-white">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    priority={product.id === paginatedProducts[0]?.id}
                    loading="eager"
                    unoptimized={isSignedMediaUrl(product.image) || isRemoteMediaUrl(product.image)}
                    className="object-contain transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
                </div>
                <div className="mt-5 space-y-1">
                  <h3 className="text-sm font-semibold text-neutral-900 text-left">
                    {product.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && !loadError && totalPages > 1 && (
          <div className="mt-16 flex items-center justify-between border-t border-neutral-200 pt-8">
            <p className="text-xs text-neutral-400 tracking-widest uppercase">
              Page {safePage} of {totalPages}
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-900 disabled:opacity-25 disabled:cursor-not-allowed transition"
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 12L6 8L10 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-9 h-9 flex items-center justify-center text-xs text-neutral-400"
                  >
                    ···
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`w-9 h-9 flex items-center justify-center text-xs tracking-wide transition ${
                      safePage === page
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                    }`}
                    aria-current={safePage === page ? "page" : undefined}
                  >
                    {page}
                  </button>
                ),
              )}

              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-900 disabled:opacity-25 disabled:cursor-not-allowed transition"
                aria-label="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;
