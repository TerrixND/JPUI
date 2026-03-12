"use client";

import {
  ApiClientError,
  getPublicProducts,
  type PublicProductRecord,
} from "@/lib/apiClient";
import { isVisibleOnPublicProductPage } from "@/lib/mediaVisibility";
import PageEntranceLoader from "@/components/ui/PageEntranceLoader";
import { gsap } from "gsap";
import Image from "next/image";
import Link from "next/link";
import React, {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type CatalogProduct = {
  id: string;
  name: string;
  image: string;
  popularity: number;
  createdAt: number;
  finish: "polished" | "raw";
};

const ITEMS_PER_PAGE = 16;
const SORT_OPTIONS = [
  { value: "", label: "Curated Order" },
  { value: "Most Asked", label: "Most Asked" },
  { value: "Latest Items", label: "Latest Items" },
  { value: "Polished", label: "Polished" },
  { value: "Raw Stone", label: "Raw Stone" },
] as const;
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
  const descriptor =
    `${product.cutAndShape || ""} ${product.description || ""}`.toLowerCase();
  return descriptor.includes("raw") ? "raw" : "polished";
};

const resolveCardImage = (product: PublicProductRecord) => {
  const media = (Array.isArray(product.media) ? product.media : []).filter(
    (entry) => isVisibleOnPublicProductPage(entry),
  );
  const preferredImage =
    media.find(
      (entry) => (entry.type || "").toUpperCase() === "IMAGE" && entry.url,
    ) || media.find((entry) => Boolean(entry.url));

  const resolved = preferredImage?.url?.trim() || "";
  return resolved || PLACEHOLDER_IMAGE;
};

const ProductPage = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

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
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    if (normalizedSearch !== "") {
      items = items.filter((p) =>
        p.name.toLowerCase().includes(normalizedSearch),
      );
    }

    switch (sort) {
      case "Most Asked":
        items.sort(
          (a, b) => b.popularity - a.popularity || b.createdAt - a.createdAt,
        );
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
  }, [deferredSearch, products, sort]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, totalPages || 1);
  const searchQuery = deferredSearch.trim();
  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ||
    "Curated Order";

  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, safePage]);

  useEffect(() => {
    if (!isSortMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        sortMenuRef.current?.contains(target) ||
        sortButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsSortMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSortMenuOpen]);

  useEffect(() => {
    const menu = sortMenuRef.current;

    if (!menu) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    gsap.killTweensOf(menu);
    gsap.killTweensOf(menu.children);

    if (prefersReducedMotion) {
      gsap.set(menu, {
        autoAlpha: isSortMenuOpen ? 1 : 0,
        y: isSortMenuOpen ? 0 : -8,
        pointerEvents: isSortMenuOpen ? "auto" : "none",
      });
      return;
    }

    if (isSortMenuOpen) {
      gsap.set(menu, {
        pointerEvents: "auto",
      });
      gsap.fromTo(
        menu,
        {
          autoAlpha: 0,
          y: -10,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.22,
          ease: "power2.out",
        },
      );
      gsap.fromTo(
        menu.children,
        {
          autoAlpha: 0,
          y: -6,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.2,
          stagger: 0.025,
          ease: "power2.out",
          delay: 0.04,
        },
      );
      return;
    }

    gsap.to(menu, {
      autoAlpha: 0,
      y: -10,
      duration: 0.16,
      ease: "power2.in",
      pointerEvents: "none",
    });
  }, [isSortMenuOpen]);

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const status = root.querySelector<HTMLElement>("[data-products-status]");
      if (status) {
        gsap.fromTo(
          status,
          {
            autoAlpha: 0,
            y: 10,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.35,
            ease: "power2.out",
            clearProps: "transform,opacity",
          },
        );
      }

      const cards = gsap.utils.toArray<HTMLElement>("[data-product-card]");
      if (cards.length) {
        gsap.fromTo(
          cards,
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.992,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            stagger: 0.04,
            ease: "power2.out",
            clearProps: "transform,opacity",
          },
        );
      }

      const pagination = root.querySelector<HTMLElement>(
        "[data-products-pagination]",
      );
      if (pagination) {
        gsap.fromTo(
          pagination.children,
          {
            autoAlpha: 0,
            y: 14,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.04,
            ease: "power2.out",
            clearProps: "transform,opacity",
          },
        );
      }
    }, root);

    return () => {
      ctx.revert();
    };
  }, [isLoading, loadError, paginatedProducts, safePage, sort, searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    setCurrentPage(1);
    setIsSortMenuOpen(false);
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
    <div
      ref={rootRef}
      className="w-full overflow-hidden bg-white py-10 text-neutral-900"
    >
      <div className="px-6 sm:px-12 lg:px-20 py-16">
        <div className="mx-auto">
          <div
            data-page-intro
            className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <h2 className="text-2xl font-light tracking-tight text-neutral-900 lg:text-4xl">
                Collection
              </h2>
              <p className="mt-2 text-sm tracking-wide text-neutral-500">
                Rare · Refined · Remarkable
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <input
                type="text"
                placeholder="Search products"
                className="w-full border border-neutral-200 bg-[#fafafa] px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 sm:w-80"
                value={search}
                onChange={handleSearchChange}
              />
              <div className="relative">
                <button
                  ref={sortButtonRef}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-6 border border-neutral-200 bg-[#fafafa] px-4 py-3 text-sm text-neutral-900 outline-none hover:border-neutral-300 focus:border-neutral-400 sm:min-w-52"
                  aria-haspopup="menu"
                  aria-expanded={isSortMenuOpen}
                  onClick={() => setIsSortMenuOpen((open) => !open)}
                >
                  <span>{activeSortLabel}</span>

                  <span className="pointer-events-none text-neutral-400">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3.5 5.25L7 8.75L10.5 5.25"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  ref={sortMenuRef}
                  className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 min-w-full border border-neutral-200 bg-white opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                  role="menu"
                  aria-hidden={!isSortMenuOpen}
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      data-sort-menu-item
                      className={`block w-full border-b border-neutral-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-neutral-50 ${
                        sort === option.value
                          ? "text-neutral-950"
                          : "text-neutral-500"
                      }`}
                      onClick={() => handleSortChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div
              data-page-intro
              className="mt-10 border border-neutral-200 bg-[#fafafa] px-6 py-10 text-sm text-neutral-500"
            >
              Loading products...
            </div>
          ) : loadError ? (
            <div
              data-page-intro
              className="mt-10 border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600"
            >
              {loadError}
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div
              data-page-intro
              className="mt-10 border border-neutral-200 bg-[#fafafa] px-6 py-10 text-sm text-neutral-500"
            >
              No products found.
            </div>
          ) : (
            <div
              data-page-intro
              className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-14"
            >
              {paginatedProducts.map((product) => (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  data-product-card
                  className="group flex-none cursor-pointer"
                >
                  <div className="w-full">
                    {/* Image */}
                    <div className="relative aspect-[3/4] overflow-hidden bg-white">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                        priority={product.id === paginatedProducts[0]?.id}
                        loading={
                          product.id === paginatedProducts[0]?.id
                            ? "eager"
                            : "lazy"
                        }
                        unoptimized={
                          isSignedMediaUrl(product.image) ||
                          isRemoteMediaUrl(product.image)
                        }
                        className="object-contain transition duration-700 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-linear-to-t from-black/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
                    </div>

                    {/* Text */}
                    <div className="mt-5 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-400">
                        {product.finish === "raw" ? "Raw Stone" : "Polished"}
                      </p>

                      <h3 className="text-sm font-semibold text-neutral-900">
                        {product.name}
                      </h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!isLoading && !loadError && totalPages > 1 && (
            <div
              data-page-intro
              data-products-pagination
              className="flex flex-col gap-5 border-t border-neutral-200 pt-8 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-neutral-400">
                Page {safePage} of {totalPages}
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="flex h-10 w-10 items-center justify-center border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
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
                      className="flex h-10 w-10 items-center justify-center text-xs text-neutral-400"
                    >
                      ···
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`flex h-10 min-w-10 items-center justify-center border px-3 text-xs transition ${
                        safePage === page
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-neutral-900"
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
                  className="flex h-10 w-10 items-center justify-center border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
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
    </div>
  );
};

export default ProductPage;
