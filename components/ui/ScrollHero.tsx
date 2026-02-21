"use client";

import React, { useRef, useEffect, useState } from "react";

interface ScrollHeroProps {
  hideAtRef?: React.RefObject<HTMLElement | null>;
}

const sections = [
  {
    id: 1,
    video: "/videos/hero-2.mp4",
    eyebrow: "Heritage Collection",
    title: ["Timeless", "Craftsmanship"],
    description:
      "Every jade piece is shaped with precision and decades of mastery.",
    button: "Explore Heritage",
    accent: "#C8A96E",
  },
  {
    id: 2,
    video: "/videos/hero-3.mp4",
    eyebrow: "Provenance",
    title: ["Rare.", "Pure.", "Powerful."],
    description: "Sourced from the finest origins, refined into wearable art.",
    button: "Discover Collection",
    accent: "#8FB8A2",
  },
  {
    id: 3,
    video: "/videos/hero-4.mp4",
    eyebrow: "New Season",
    title: ["Luxury", "Redefined"],
    description:
      "Minimal form. Maximum elegance. Designed for the modern elite.",
    button: "Shop Now",
    accent: "#B8A9C9",
  },
];

const ScrollHero: React.FC<ScrollHeroProps> = ({ hideAtRef }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showDots, setShowDots] = useState(true);

  useEffect(() => {
    const observers = sectionRefs.current.map((ref, i) => {
      if (!ref) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveIndex(i);
            setAnimKey((k) => k + 1);
          }
        },
        { threshold: 0.5, root: containerRef.current },
      );
      obs.observe(ref);
      return obs;
    });
    return () => observers.forEach((obs) => obs?.disconnect());
  }, []);

  /* Detect if ScrollHero is visible on page */
  useEffect(() => {
    if (!hideAtRef?.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowDots(!entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(hideAtRef.current);
    return () => observer.disconnect();
  }, [hideAtRef]);

  const scrollToSection = (i: number) => {
    sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative sh-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400&display=swap');

        .sh-display { font-family: 'Cormorant Garamond', serif; }
        .sh-sans    { font-family: 'Jost', sans-serif; }
        .sh-root    { background: #000; }

        /* Snap scroll on the container */
        .sh-snap-container {
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          min-height: 100svh;
          height: 100svh;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          background: #000;
        }
        .sh-snap-section {
          scroll-snap-align: start;
          min-height: 100svh;
          height: 100svh;
        }

        @supports (height: 100dvh) {
          .sh-snap-container,
          .sh-snap-section {
            min-height: 100dvh;
            height: 100dvh;
          }
        }

        /* Video fills section without overflow distortion */
        .sh-video {
          transform: scale(1.04);
          transition: transform 1.2s ease;
          object-fit: cover;
          object-position: center center;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .sh-snap-section:hover .sh-video { transform: scale(1); }

        /* Small screens: no scale, anchor to top-center for better framing */
        @media (max-width: 640px) {
          .sh-video {
            transform: scale(1) !important;
            object-position: center 20%;
          }
        }

        /* Tablets: slight scale, center framing */
        @media (min-width: 641px) and (max-width: 1024px) {
          .sh-video {
            transform: scale(1.02);
            object-position: center center;
          }
          .sh-snap-section:hover .sh-video { transform: scale(1); }
        }

        /* Landscape mobile: no scale, fit naturally */
        @media (max-width: 896px) and (orientation: landscape) {
          .sh-video {
            transform: scale(1) !important;
            object-position: center center;
          }
        }

        /* Button slide-fill effect */
        .sh-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--accent);
          transform: translateX(-101%);
          transition: transform 0.4s cubic-bezier(0.76, 0, 0.24, 1);
        }
        .sh-btn:hover::before { transform: translateX(0); }
        .sh-btn:hover { color: #0a0a0a; border-color: var(--accent); }

        /* Animated arrow inside button */
        .sh-arrow {
          position: relative;
          z-index: 1;
          display: inline-block;
          width: 1.2rem;
          height: 1px;
          background: currentColor;
          transition: width 0.3s ease;
        }
        .sh-btn:hover .sh-arrow { width: 1.8rem; }

        /* Staggered entrance animations */
        @keyframes sh-up {
          from { opacity: 0; transform: translateY(var(--y)); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sh-a1 { opacity:0; animation: sh-up 0.8s 0.20s forwards ease-out; --y: 16px; }
        .sh-a2 { opacity:0; animation: sh-up 0.9s 0.38s forwards ease-out; --y: 24px; }
        .sh-a3 { opacity:0; animation: sh-up 0.9s 0.52s forwards ease-out; --y: 20px; }
        .sh-a4 { opacity:0; animation: sh-up 0.9s 0.66s forwards ease-out; --y: 16px; }

        /* Active nav dot pill */
        .sh-dot-on { height: 24px !important; border-radius: 2px !important; background: #fff !important; }

        /* Vertical text counter */
        .sh-vertical { writing-mode: vertical-rl; }

        .sh-nav-dots {
          right: calc(1.5rem + env(safe-area-inset-right));
        }

        .sh-content {
          padding-left: calc(5vw + env(safe-area-inset-left));
          padding-right: calc(5vw + env(safe-area-inset-right));
          padding-bottom: calc(8vh + env(safe-area-inset-bottom));
        }

        /* ── Responsive overrides ────────────────────────────────────────── */

        /* Nav dots: move closer to edge on small screens */
        @media (max-width: 640px) {
          .sh-nav-dots {
            right: calc(0.75rem + env(safe-area-inset-right)) !important;
            gap: 0.6rem !important;
          }

          /* Section counter: hide on very small screens to save space */
          .sh-counter { display: none !important; }

          /* Left decorative line: subtler inset */
          .sh-deco-line { left: 1rem !important; }

          /* Content block: reduce horizontal & bottom padding */
          .sh-content {
            padding-left: calc(1.25rem + env(safe-area-inset-left)) !important;
            padding-right: calc(3rem + env(safe-area-inset-right)) !important; /* keep clear of nav dots */
            padding-bottom: calc(6vh + env(safe-area-inset-bottom)) !important;
            max-width: 100% !important;
          }

          /* Title: tighter size floor */
          .sh-title {
            font-size: clamp(2.6rem, 13vw, 4.5rem) !important;
            margin-bottom: 1.25rem !important;
          }

          /* Description: shorter measure */
          .sh-description {
            max-width: 100% !important;
            margin-bottom: 2rem !important;
          }

          /* Button: slightly more compact */
          .sh-btn {
            padding: 0.75rem 1.4rem !important;
          }

          /* Eyebrow gap */
          .sh-eyebrow { margin-bottom: 1rem !important; }
        }

        /* Tablet breakpoint */
        @media (min-width: 641px) and (max-width: 1024px) {
          .sh-nav-dots { right: calc(1.25rem + env(safe-area-inset-right)) !important; }

          .sh-content {
            padding-left: calc(4vw + env(safe-area-inset-left)) !important;
            padding-right: calc(4rem + env(safe-area-inset-right)) !important;
            padding-bottom: calc(7vh + env(safe-area-inset-bottom)) !important;
            max-width: 80% !important;
          }

          .sh-title {
            font-size: clamp(3rem, 9vw, 5.5rem) !important;
          }

          .sh-description {
            max-width: 380px !important;
          }
        }

        /* Ensure touch devices don't get the scale zoom */
        @media (hover: none) and (pointer: coarse) {
          .sh-video { transform: scale(1) !important; }
          .sh-snap-section { height: 100dvh; }
        }

        /* Landscape mobile: shorten vertical padding so content fits */
        @media (max-width: 896px) and (orientation: landscape) {
          .sh-content {
            padding-bottom: calc(4vh + env(safe-area-inset-bottom)) !important;
          }
          .sh-title {
            font-size: clamp(2rem, 8vw, 3.5rem) !important;
            margin-bottom: 0.75rem !important;
          }
          .sh-description {
            display: none !important; /* collapse description to save vertical room */
          }
          .sh-eyebrow { margin-bottom: 0.5rem !important; }
        }
      `}</style>

      {/* ───────────── Nav Dots ───────────── */}
      <div
        className={`sh-nav-dots fixed right-10 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4 transition-opacity duration-500 ${
          showDots ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {sections.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => scrollToSection(i)}
            className={`w-1 h-1 rounded-full bg-white/30 transition-all duration-300 ${
              activeIndex === i ? "h-6 bg-white rounded-sm" : ""
            }`}
          />
        ))}
      </div>

      {/* ── Scroll container ────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="sh-snap-container sh-sans overflow-y-auto overscroll-y-contain snap-y snap-mandatory scroll-smooth"
      >
        {sections.map((section, i) => (
          <section
            key={section.id}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            className="sh-snap-section relative w-full overflow-hidden flex items-end justify-start"
            style={{ "--accent": section.accent } as React.CSSProperties}
          >
            {/* Video background */}
            <video autoPlay loop muted playsInline className="sh-video">
              <source src={section.video} type="video/mp4" />
            </video>

            {/* Gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.28) 55%,rgba(0,0,0,.08) 100%)",
              }}
            />

            {/* Left decorative line */}
            <div
              className="sh-deco-line absolute top-0 left-[5vw] w-px h-full z-5"
              style={{
                background:
                  "linear-gradient(to bottom,transparent,rgba(255,255,255,.12),transparent)",
              }}
            />

            {/* Section counter — vertical text */}
            <div
              className="sh-counter sh-vertical sh-display absolute right-[5vw] top-1/2 -translate-y-1/2 z-10 text-white/30"
              style={{
                writingMode: "vertical-rl",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 200,
                fontSize: "0.9rem",
                letterSpacing: "0.4em",
              }}
            >
              0{section.id} — 0{sections.length}
            </div>

            {/* ── Animated content block ──────────────────────────────── */}
            <div
              key={`${animKey}-${i}`}
              className="sh-content relative z-10 max-w-175 px-[5vw] pb-[8vh]"
            >
              {/* Eyebrow */}
              <p
                className="sh-eyebrow sh-a1 sh-sans flex items-center gap-3 uppercase mb-6"
                style={{
                  fontWeight: 300,
                  fontSize: "0.72rem",
                  letterSpacing: "0.28em",
                  color: "var(--accent)",
                }}
              >
                <span
                  className="shrink-0 h-px w-8"
                  style={{ background: "var(--accent)" }}
                />
                {section.eyebrow}
              </p>

              {/* Title */}
              <h1
                className="sh-a2 sh-title sh-display font-light text-white m-0 mb-8"
                style={{
                  fontSize: "clamp(3.6rem, 8vw, 7rem)",
                  lineHeight: 0.92,
                  letterSpacing: "-0.01em",
                }}
              >
                {section.title.map((line, j) => (
                  <span key={j} className="block">
                    {j === 0 ? (
                      <em
                        style={{ fontStyle: "italic", color: "var(--accent)" }}
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
              <p
                className="sh-description sh-a3 sh-sans text-white/65 max-w-85 mb-11"
                style={{
                  fontWeight: 200,
                  fontSize: "1rem",
                  lineHeight: 1.75,
                  letterSpacing: "0.04em",
                }}
              >
                {section.description}
              </p>

              {/* CTA button */}
              <button
                className="sh-a4 sh-btn sh-sans inline-flex items-center gap-3 uppercase text-white bg-transparent cursor-pointer relative overflow-hidden transition-colors duration-300"
                style={{
                  fontWeight: 300,
                  fontSize: "0.72rem",
                  letterSpacing: "0.22em",
                  border: "1px solid rgba(255,255,255,0.35)",
                  padding: "1rem 2rem",
                }}
              >
                <span className="relative z-1">{section.button}</span>
                <span className="sh-arrow" />
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default ScrollHero;
