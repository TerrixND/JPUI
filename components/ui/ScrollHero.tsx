"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";

const slides = [
  {
    id: 1,
    image: "/images/ab1.png",
    eyebrow: "Heritage Collection",
    title: ["Timeless", "Craftsmanship"],
    description:
      "Every jade piece is shaped with precision and decades of mastery.",
    button: "Explore Heritage",
    accent: "#C8A96E",
  },
  {
    id: 2,
    image: "/images/ab2.png",
    eyebrow: "Provenance",
    title: ["Rare.", "Pure.", "Powerful."],
    description:
      "Sourced from the finest origins, refined into wearable art.",
    button: "Discover Collection",
    accent: "#8FB8A2",
  },
  {
    id: 3,
    image: "/images/ab3.png",
    eyebrow: "New Season",
    title: ["Luxury", "Redefined"],
    description:
      "Minimal form. Maximum elegance. Designed for the modern elite.",
    button: "Shop Now",
    accent: "#B8A9C9",
  },
];

const DURATION = 5000;

export default function ScrollHero() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const total = slides.length;

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const next = useCallback(() => {
    goTo((current + 1) % total);
  }, [current, total, goTo]);

  const back = useCallback(() => {
    goTo((current - 1 + total) % total);
  }, [current, total, goTo]);

  useEffect(() => {
    timerRef.current = setTimeout(next, DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, next]);

  const slide = slides[current];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">

      {/* Background */}
      <img
        src={slide.image}
        className="absolute inset-0 w-full h-full object-cover animate-slow-zoom"
        alt=""
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Text */}
      <div className="absolute inset-0 flex items-center z-20">
        <div
          className="ml-16 md:ml-24 max-w-2xl flex flex-col gap-5"
          style={{ "--accent": slide.accent } as React.CSSProperties}
        >
          <p className="text-sm uppercase text-white/60">
            {slide.eyebrow}
          </p>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-none">
            {slide.title.map((line, i) => (
              <span key={i} className="block">
                {i === 0 ? (
                  <em
                    className="not-italic"
                    style={{ color: "var(--accent)" }}
                  >
                    {line}
                  </em>
                ) : (
                  line
                )}
              </span>
            ))}
          </h1>

          <p className="text-white/60 max-w-sm">
            {slide.description}
          </p>

          <Link href={"/products"}
            className="px-6 py-3 text-black font-semibold w-fit cursor-pointer"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {slide.button}
          </Link>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-16 md:px-24 pb-8 flex items-center gap-6">

        {/* Previous */}
        <button
          onClick={back}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:text-white"
        >
          <ChevronLeft />
        </button>

        {/* Progress */}
        <div className="flex flex-1 gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="relative flex-1 h-px bg-white/20 overflow-hidden"
            >
              <span
                className={`absolute inset-y-0 left-0 ${
                  i === current
                    ? "animate-progress"
                    : i < current
                    ? "w-full"
                    : "w-0"
                }`}
                style={{
                  backgroundColor:
                    i === current ? slide.accent : "white",
                }}
              />
            </button>
          ))}
        </div>

        {/* Next */}
        <button
          onClick={next}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:text-white"
        >
          <ChevronRight />
        </button>
      </div>

      <style>{`
        @keyframes slowZoom {
          from { transform: scale(1); }
          to { transform: scale(1.06); }
        }

        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }

        .animate-slow-zoom {
          animation: slowZoom 10s linear forwards;
        }

        .animate-progress {
          animation: progress 5s linear forwards;
        }
      `}</style>
    </div>
  );
}