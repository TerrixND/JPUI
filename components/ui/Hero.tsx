"use client";

import React, { useEffect, useState } from "react";

const Hero = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative w-full overflow-hidden" style={{ height: "100svh" }}>
      {/* Background Video */}
      <video
        className="absolute top-0 left-0 w-full h-full object-cover scale-105"
        src="/videos/hero-4.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Layered Overlays */}
      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/40 to-black/70" />
      <div className="absolute inset-0 bg-linear-to-r from-emerald-950/30 via-transparent to-emerald-950/30" />

      {/* Decorative corner accents */}
      {/* <div className="absolute top-6 left-6 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-t border-l border-emerald-300/50 pointer-events-none" />
      <div className="absolute top-6 right-6 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-t border-r border-emerald-300/50 pointer-events-none" />
      <div className="absolute bottom-6 left-6 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-b border-l border-emerald-300/50 pointer-events-none" />
      <div className="absolute bottom-6 right-6 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 border-b border-r border-emerald-300/50 pointer-events-none" /> */}

      {/* Horizontal rule accents */}
      {/* <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-emerald-400/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-emerald-400/40 to-transparent" /> */}

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center text-white px-4 sm:px-8 md:px-12 lg:px-16">
        {/* Top ornament */}
        <div
          className="flex items-center gap-3 mb-6 sm:mb-8 md:mb-10"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(-12px)",
            transition: "opacity 1s ease 0.2s, transform 1s ease 0.2s",
          }}
        >
          <div className="h-px w-8 sm:w-12 md:w-20 bg-linear-to-r from-transparent to-emerald-300/70" />
          <span
            className="tracking-[0.35em] text-emerald-300/80 font-light"
            style={{
              fontSize: "clamp(1rem, 1.5vw, 0.75rem)",
              fontFamily: "'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
            }}
          >
            Since 2003
          </span>
          <div className="h-px w-8 sm:w-12 md:w-20 bg-linear-to-l from-transparent to-emerald-300/70" />
        </div>

        {/* Main Heading */}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
            fontSize: "clamp(2.8rem, 9vw, 8rem)",
            fontWeight: 300,
            letterSpacing: "0.12em",
            lineHeight: 1.05,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 1.2s ease 0.5s, transform 1.2s ease 0.5s",
          }}
          className="mb-2 sm:mb-3"
        >
          <span className="block italic text-white/90">Jade</span>
          <span
            className="block text-emerald-200"
            style={{ letterSpacing: "0.25em", fontStyle: "normal", fontWeight: 400 }}
          >
            PALACE
          </span>
        </h1>

        {/* Divider with jade motif */}
        <div
          className="flex items-center gap-3 sm:gap-4 my-5 sm:my-6 md:my-8"
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 1s ease 0.9s",
          }}
        >
          <div className="h-px w-10 sm:w-16 md:w-24 bg-linear-to-r from-transparent via-emerald-300/60 to-emerald-300/60" />
          {/* Jade diamond motif */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className="text-emerald-300/80 shrink-0 sm:w-4 sm:h-4 md:w-5 md:h-5"
          >
            <polygon points="7,0 14,7 7,14 0,7" fill="currentColor" opacity="0.8" />
            <polygon
              points="7,2 12,7 7,12 2,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              opacity="0.5"
            />
          </svg>
          <div className="h-px w-10 sm:w-16 md:w-24 bg-linear-to-l from-transparent via-emerald-300/60 to-emerald-300/60" />
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
            fontSize: "clamp(0.85rem, 2.5vw, 1.15rem)",
            letterSpacing: "0.4em",
            fontWeight: 300,
            opacity: loaded ? 0.75 : 0,
            transform: loaded ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 1s ease 1.1s, transform 1s ease 1.1s",
          }}
          className="uppercase text-white mb-8 sm:mb-10 md:mb-12 max-w-xs sm:max-w-sm md:max-w-md mx-auto"
        >
          Luxury Jade Collection
        </p>

        {/* CTA Buttons */}
        <div
          className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 md:gap-6"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 1s ease 1.3s, transform 1s ease 1.3s",
          }}
        >
          <button
            className="group relative px-7 py-3 sm:px-8 sm:py-3.5 md:px-10 md:py-4 w-44 sm:w-auto overflow-hidden border border-emerald-300/60 text-white/90 uppercase tracking-widest hover:text-white transition-all duration-500 cursor-pointer"
            style={{
              fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)",
              fontFamily: "'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
              fontWeight: 500,
            }}
          >
            <span className="absolute inset-0 bg-emerald-800/0 group-hover:bg-emerald-800/40 transition-colors duration-500" />
            <span className="relative z-10">Explore Now</span>
          </button>

          <button
            className="group flex items-center gap-2 sm:gap-3 text-white/60 hover:text-emerald-300 transition-colors duration-400 cursor-pointer"
            style={{
              fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)",
              fontFamily: "'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
              fontWeight: 400,
              letterSpacing: "0.25em",
            }}
          >
            <span className="uppercase tracking-widest">Our Story</span>
            <svg
              width="18"
              height="8"
              viewBox="0 0 18 8"
              fill="none"
              className="transition-transform duration-400 group-hover:translate-x-1"
            >
              <path d="M0 4H16M16 4L13 1M16 4L13 7" stroke="currentColor" strokeWidth="0.8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{
          opacity: loaded ? 0.5 : 0,
          transition: "opacity 1s ease 1.8s",
        }}
      >
        <span
          className="text-white uppercase tracking-[0.3em]"
          style={{
            fontSize: "0.55rem",
            fontFamily: "'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
          }}
        >
          Scroll
        </span>
        <div className="w-px h-8 sm:h-10 bg-linear-to-b from-white/40 to-transparent animate-pulse" />
      </div>

      {/* Google Fonts import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
      `}</style>
    </section>
  );
};

export default Hero;