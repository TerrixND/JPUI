"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const products = [
  {
    id: 1,
    name: "Emerald Harmony Necklace",
    image: "/images/img1.png",
  },
  {
    id: 2,
    name: "Imperial Jade Ring",
    image: "/images/img2.png",
  },
  {
    id: 3,
    name: "Celestial Drop Earrings",
    image: "/images/img3.png",
  },
  {
    id: 4,
    name: "Serenity Jade Bracelet",
    image: "/images/img4.png",
  },
  {
    id: 5,
    name: "Emerald Harmony Necklace",
    image: "/images/img1.png",
  },
  {
    id: 6,
    name: "Imperial Jade Ring",
    image: "/images/img2.png",
  },
];

const CARD_WIDTH = 260; // must match Tailwind width below
const GAP = 24; // gap-6 = 24px

const NewArrival = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = CARD_WIDTH + GAP;

    el.scrollBy({
      left: dir === "right" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="w-full bg-white py-20 lg:py-28">
      <div className="px-6 sm:px-12 lg:px-20">
        {/* ===== Header ===== */}
        <div className="mb-14 flex items-end justify-between">
          <div>
            <h2 className="text-3xl lg:text-4xl font-light tracking-tight text-neutral-900">
              New Arrivals
            </h2>
            <p className="text-sm text-neutral-400 mt-2 tracking-wide">
              Latest jade masterpieces
            </p>
          </div>

          {/* Desktop Arrows */}
          <div className="hidden md:flex gap-3">
            <button
              onClick={() => scroll("left")}
              className="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-neutral-900 hover:text-white transition"
            >
              ←
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center hover:bg-neutral-900 hover:text-white transition"
            >
              →
            </button>
          </div>
        </div>

        {/* ===== Scroll Area ===== */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 no-scrollbar"
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="group flex-none w-60 sm:w-65 snap-start cursor-pointer"
            >
              {/* Image */}
              <div className="relative aspect-3/4 overflow-hidden bg-white">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  priority={product.id === 1}
                  className="object-contain transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-linear-to-t from-black/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
              </div>

              {/* Text */}
              <div className="mt-5 space-y-1">
                <h3 className="text-sm font-semibold text-neutral-900">
                  {product.name}
                </h3>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile View All */}
        <div className="mt-12 flex justify-center md:hidden">
          <Link
            href="#"
            className="text-sm tracking-widest uppercase text-neutral-500 hover:text-neutral-900 transition"
          >
            View All →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NewArrival;
