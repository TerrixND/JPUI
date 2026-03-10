"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";

const slides = [
  {
    id: 1,
    image: "/images/ab1.png",
    eyebrow: "Heritage Collection",
    title: ["Handcrafted", "Jade Jewelry"],
    description: "Each piece is carefully made by skilled artisans with over 30 years of experience.",
    button: "Explore Collection",
    accent: "#C8A96E",
    accentRgb: "200, 169, 110",
    number: "01",
  },
  {
    id: 2,
    image: "/images/ab2.png",
    eyebrow: "Premium Quality",
    title: ["Only the", "Finest Jade"],
    description: "We hand-select every stone for its color, clarity, and natural beauty.",
    button: "Shop Jade Pieces",
    accent: "#8FB8A2",
    accentRgb: "143, 184, 162",
    number: "02",
  },
  {
    id: 3,
    image: "/images/ab3.png",
    eyebrow: "New Arrivals",
    title: ["Elegant.", "Timeless.", "Yours."],
    description: "Discover our newest designs — simple, beautiful jewelry for everyday wear.",
    button: "See New Arrivals",
    accent: "#B8A9C9",
    accentRgb: "184, 169, 201",
    number: "03",
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

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center md:justify-start z-20 px-6 md:px-20">

        <div
          className="max-w-lg flex flex-col gap-4 md:gap-6 text-center md:text-left"
          style={{ "--accent": slide.accent } as React.CSSProperties}
        >
          {/* Eyebrow */}
          <p className="text-[11px] md:text-xs uppercase tracking-[0.25em] text-white/50 font-medium">
            {slide.eyebrow}
          </p>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-tight tracking-tight">
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

          {/* Description */}
          <p className="text-white/70 text-sm md:text-base leading-relaxed max-w-md mx-auto md:mx-0">
            {slide.description}
          </p>

          {/* Button */}
          <Link
            href={"/products"}
            className="px-6 py-3 text-sm font-medium tracking-wide text-black w-fit mx-auto md:mx-0 transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {slide.button}
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-6 md:px-20 pb-6 md:pb-8 flex items-center gap-4 md:gap-6">

        <button
          onClick={back}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:text-white transition"
        >
          <ChevronLeft size={18} />
        </button>

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

        <button
          onClick={next}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:text-white transition"
        >
          <ChevronRight size={18} />
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