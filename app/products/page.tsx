"use client";
import Image from "next/image";
import React, { useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  image: string;
  popularity: number;
  createdAt: number;
  finish: "polished" | "raw";
};

const PRODUCTS: Product[] = [
  { id: 1, name: "Emerald Harmony Necklace", image: "/images/img1.png", popularity: 120, createdAt: 20240110, finish: "polished" },
  { id: 2, name: "Imperial Jade Ring", image: "/images/img2.png", popularity: 300, createdAt: 20240201, finish: "raw" },
  { id: 3, name: "Celestial Drop Earrings", image: "/images/img3.png", popularity: 220, createdAt: 20240315, finish: "polished" },
  { id: 4, name: "Serenity Jade Bracelet", image: "/images/img4.png", popularity: 180, createdAt: 20240402, finish: "raw" },
  { id: 5, name: "Golden Vein Jade Pendant", image: "/images/img1.png", popularity: 260, createdAt: 20240511, finish: "polished" },
  { id: 6, name: "Imperial Green Bangle", image: "/images/img2.png", popularity: 340, createdAt: 20240621, finish: "raw" },
  { id: 7, name: "Lotus Carved Jade Ring", image: "/images/img3.png", popularity: 150, createdAt: 20240709, finish: "polished" },
  { id: 8, name: "Harmony Stone Bracelet", image: "/images/img4.png", popularity: 210, createdAt: 20240814, finish: "raw" },
  { id: 9, name: "Dynasty Jade Pendant", image: "/images/img1.png", popularity: 390, createdAt: 20240901, finish: "polished" },
  { id: 10, name: "Eternal Glow Earrings", image: "/images/img2.png", popularity: 175, createdAt: 20240928, finish: "raw" },
  { id: 11, name: "Imperial Carved Necklace", image: "/images/img3.png", popularity: 285, createdAt: 20241016, finish: "polished" },
  { id: 12, name: "Serene Jade Drop Pendant", image: "/images/img4.png", popularity: 195, createdAt: 20241103, finish: "raw" },
  { id: 13, name: "Celestial Harmony Ring", image: "/images/img1.png", popularity: 410, createdAt: 20241201, finish: "polished" },
  { id: 14, name: "Golden Serenity Bangle", image: "/images/img2.png", popularity: 240, createdAt: 20241218, finish: "raw" },
  { id: 15, name: "Dynasty Glow Bracelet", image: "/images/img3.png", popularity: 320, createdAt: 20250105, finish: "polished" },
  { id: 16, name: "Emerald Lotus Earrings", image: "/images/img4.png", popularity: 205, createdAt: 20250122, finish: "raw" },

  { id: 17, name: "Imperial Harmony Pendant", image: "/images/img1.png", popularity: 275, createdAt: 20250210, finish: "polished" },
  { id: 18, name: "Jade Dynasty Ring", image: "/images/img2.png", popularity: 360, createdAt: 20250302, finish: "raw" },
  { id: 19, name: "Celestial Glow Necklace", image: "/images/img3.png", popularity: 190, createdAt: 20250325, finish: "polished" },
  { id: 20, name: "Golden Lotus Bracelet", image: "/images/img4.png", popularity: 230, createdAt: 20250414, finish: "raw" },
  { id: 21, name: "Emerald Crown Pendant", image: "/images/img1.png", popularity: 410, createdAt: 20250501, finish: "polished" },
  { id: 22, name: "Imperial Forest Ring", image: "/images/img2.png", popularity: 295, createdAt: 20250520, finish: "raw" },
  { id: 23, name: "Serenity Glow Earrings", image: "/images/img3.png", popularity: 160, createdAt: 20250608, finish: "polished" },
  { id: 24, name: "Jade Harmony Bangle", image: "/images/img4.png", popularity: 340, createdAt: 20250625, finish: "raw" },
  { id: 25, name: "Golden Dynasty Necklace", image: "/images/img1.png", popularity: 380, createdAt: 20250711, finish: "polished" },
  { id: 26, name: "Celestial Jade Bracelet", image: "/images/img2.png", popularity: 210, createdAt: 20250729, finish: "raw" },
  { id: 27, name: "Emerald Vein Ring", image: "/images/img3.png", popularity: 185, createdAt: 20250813, finish: "polished" },
  { id: 28, name: "Imperial Stone Pendant", image: "/images/img4.png", popularity: 325, createdAt: 20250902, finish: "raw" },
  { id: 29, name: "Serene Harmony Necklace", image: "/images/img1.png", popularity: 260, createdAt: 20250918, finish: "polished" },
  { id: 30, name: "Golden Glow Earrings", image: "/images/img2.png", popularity: 305, createdAt: 20251005, finish: "raw" },
  { id: 31, name: "Dynasty Lotus Bracelet", image: "/images/img3.png", popularity: 445, createdAt: 20251022, finish: "polished" },
  { id: 32, name: "Imperial Emerald Bangle", image: "/images/img4.png", popularity: 215, createdAt: 20251109, finish: "raw" },
];

const ITEMS_PER_PAGE = 16;

const ProductPage = () => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProducts = useMemo(() => {
    let items = [...PRODUCTS];

    if (search.trim() !== "") {
      items = items.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    switch (sort) {
      case "Most Asked":
        items.sort((a, b) => b.popularity - a.popularity);
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
  }, [search, sort]);

  // Reset to page 1 when filters/search change
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

  // Generate page numbers with ellipsis
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
      {/* Header */}
      <div className="px-6 sm:px-12 lg:px-20 relative py-16">
        <div className="top-0 z-40 bg-white">
          <div className="mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left: Title */}
            <div>
              <h2 className="text-2xl lg:text-4xl font-light tracking-tight text-neutral-900">
                Collection
              </h2>
              <p className="text-sm text-neutral-500 mt-2 tracking-wide">
                Rare · Refined · Remarkable
              </p>
            </div>

            {/* Right: Filters */}
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

        {/* Result Count */}
        {search.trim() !== "" && (
          <div className="mt-8 text-sm text-neutral-500">
            {filteredProducts.length} products
          </div>
        )}

        {/* Product Grid */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-14">
          {paginatedProducts.map((product) => (
            <div key={product.id} className="group cursor-pointer">
              <div className="relative aspect-3/4 overflow-hidden bg-white">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  priority={product.id === 1}
                  loading="eager"
                  className="object-contain transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
              </div>
              <div className="mt-5 space-y-1">
                <h3 className="text-sm font-semibold text-neutral-900 text-left">
                  {product.name}
                </h3>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-16 flex items-center justify-between border-t border-neutral-200 pt-8">
            {/* Page info */}
            <p className="text-xs text-neutral-400 tracking-widest uppercase">
              Page {safePage} of {totalPages}
            </p>

            {/* Controls */}
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-900 disabled:opacity-25 disabled:cursor-not-allowed transition"
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Page Numbers */}
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
                    className={`w-9 h-9 flex items-center justify-center text-xs tracking-wide transition
                      ${
                        safePage === page
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                      }`}
                    aria-current={safePage === page ? "page" : undefined}
                  >
                    {page}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-900 disabled:opacity-25 disabled:cursor-not-allowed transition"
                aria-label="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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