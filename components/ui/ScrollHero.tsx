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
    const heroRef = useRef<HTMLDivElement>(null);
    const [showDots, setShowDots] = useState(true);

    /* ── Mandatory snap within the hero, free scroll once past it ─────────
     * While the viewport is inside the hero area → mandatory snap so each
     * scroll gesture moves exactly one slide.
     * Once scrollY reaches the content section → snap is removed so the
     * rest of the page scrolls normally.
     * ─────────────────────────────────────────────────────────────────── */
    useEffect(() => {
        document.documentElement.style.scrollSnapType = "y mandatory";

        const handleScroll = () => {
            // Use the actual rendered hero height (immune to vh/dvh mismatches)
            const heroEl = heroRef.current;
            const heroEnd = heroEl
                ? heroEl.offsetTop + heroEl.offsetHeight
                : window.innerHeight * sections.length;

            if (window.scrollY > heroEnd + 50) {
                // Deep in content — free scroll
                if (document.documentElement.style.scrollSnapType !== "none") {
                    document.documentElement.style.scrollSnapType = "none";
                }
            } else {
                // In hero OR at the hero↔content boundary — mandatory snap.
                // This covers both the hero section-by-section snapping AND
                // the snap-back from content → hero on a single upward scroll.
                if (document.documentElement.style.scrollSnapType !== "y mandatory") {
                    document.documentElement.style.scrollSnapType = "y mandatory";
                }
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            document.documentElement.style.scrollSnapType = "";
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

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
                { threshold: 0.5 },
            );
            obs.observe(ref);
            return obs;
        });
        return () => observers.forEach((obs) => obs?.disconnect());
    }, []);

    useEffect(() => {
        if (!hideAtRef?.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => setShowDots(!entry.isIntersecting),
            { threshold: 0.1 },
        );
        observer.observe(hideAtRef.current);
        return () => observer.disconnect();
    }, [hideAtRef]);

    const scrollToSection = (i: number) => {
        sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div ref={heroRef} className="bg-black">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400&display=swap');

        .sh-display { font-family: 'Cormorant Garamond', serif; }
        .sh-sans    { font-family: 'Jost', sans-serif; }

        /* ── Each snap section fills exactly one screen ── */
        .sh-snap-section {
          scroll-snap-align: start;
          scroll-snap-stop: always;
          position: relative;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
        }

        /* ── Video ── */
        .sh-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          transform: scale(1.04);
          transition: transform 1.4s ease;
          will-change: transform;
        }
        @media (hover: hover) {
          .sh-snap-section:hover .sh-video { transform: scale(1); }
        }
        @media (hover: none), (max-width: 1024px) {
          .sh-video { transform: scale(1) !important; }
        }
        @media (max-width: 640px) and (orientation: portrait) {
          .sh-video { object-position: center 25%; }
        }
        @media (max-width: 896px) and (orientation: landscape) {
          .sh-video { object-position: center center; }
        }

        /* ── Overlay gradient ── */
        .sh-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            155deg,
            rgba(0,0,0,.78) 0%,
            rgba(0,0,0,.40) 45%,
            rgba(0,0,0,.10) 100%
          );
        }
        @media (max-width: 640px) {
          .sh-overlay {
            background: linear-gradient(
              160deg,
              rgba(0,0,0,.85) 0%,
              rgba(0,0,0,.50) 50%,
              rgba(0,0,0,.12) 100%
            );
          }
        }

        /* ── Left decorative line ── */
        .sh-deco-line {
          position: absolute;
          top: 0;
          left: clamp(1rem, 5vw, 4rem);
          width: 1px;
          height: 100%;
          z-index: 5;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(255,255,255,.12),
            transparent
          );
          pointer-events: none;
        }
        @media (max-width: 360px) { .sh-deco-line { display: none; } }

        /* ── Section counter (vertical) ── */
        .sh-counter {
          position: absolute;
          right: clamp(2.5rem, 5vw, 4rem);
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
          writing-mode: vertical-rl;
          font-family: 'Jost', sans-serif;
          font-weight: 200;
          font-size: 0.8rem;
          letter-spacing: 0.4em;
          color: rgba(255,255,255,.28);
          pointer-events: none;
          user-select: none;
        }
        @media (max-width: 1024px) { .sh-counter { display: none; } }

        /* ── Content block ── */
        .sh-content {
          position: relative;
          z-index: 10;
          width: 100%;
          padding-left:  clamp(1.25rem, 5vw, 5rem);
          padding-right: clamp(3.5rem,  12vw, 6rem);
          padding-bottom: clamp(4vh, 8vh, 10vh);
          max-width: 56rem;
          box-sizing: border-box;
        }
        @media (max-width: 896px) and (orientation: landscape) {
          .sh-content { padding-bottom: clamp(2vh, 4vh, 5vh); }
        }

        /* ── Eyebrow ── */
        .sh-eyebrow {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-transform: uppercase;
          font-family: 'Jost', sans-serif;
          font-weight: 300;
          font-size: clamp(0.62rem, 1.2vw, 0.75rem);
          letter-spacing: 0.28em;
          color: var(--accent);
          margin-bottom: clamp(0.75rem, 2vh, 1.5rem);
        }
        .sh-eyebrow-line {
          flex-shrink: 0;
          height: 1px;
          width: clamp(1.5rem, 3vw, 2.5rem);
          background: var(--accent);
        }

        /* ── Title ── */
        .sh-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          color: #fff;
          margin: 0 0 clamp(0.75rem, 2.5vh, 2rem);
          font-size: clamp(2.6rem, 8vw, 7rem);
          line-height: 0.92;
          letter-spacing: -0.01em;
        }
        @media (max-width: 896px) and (orientation: landscape) {
          .sh-title { font-size: clamp(2rem, 8vw, 3.2rem); }
        }

        /* ── Description ── */
        .sh-description {
          font-family: 'Jost', sans-serif;
          font-weight: 200;
          font-size: clamp(0.875rem, 1.5vw, 1rem);
          line-height: 1.75;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,.65);
          max-width: 28rem;
          margin-bottom: clamp(1.5rem, 4vh, 2.75rem);
        }
        @media (max-width: 896px) and (orientation: landscape) {
          .sh-description { display: none; }
        }

        /* ── CTA Button ── */
        .sh-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          text-transform: uppercase;
          font-family: 'Jost', sans-serif;
          font-weight: 300;
          font-size: clamp(0.65rem, 1.2vw, 0.72rem);
          letter-spacing: 0.22em;
          color: #fff;
          background: transparent;
          border: 1px solid rgba(255,255,255,.35);
          padding: clamp(0.65rem, 1.5vh, 1rem) clamp(1.25rem, 3vw, 2rem);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: color 0.3s ease, border-color 0.3s ease;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .sh-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--accent);
          transform: translateX(-101%);
          transition: transform 0.4s cubic-bezier(0.76, 0, 0.24, 1);
        }
        @media (hover: hover) {
          .sh-btn:hover::before { transform: translateX(0); }
          .sh-btn:hover { color: #0a0a0a; border-color: var(--accent); }
          .sh-btn:hover .sh-arrow { width: 1.8rem; }
        }
        @media (hover: none) {
          .sh-btn:active::before { transform: translateX(0); }
          .sh-btn:active { color: #0a0a0a; border-color: var(--accent); }
        }

        /* ── Arrow inside button ── */
        .sh-arrow {
          position: relative;
          z-index: 1;
          display: inline-block;
          width: 1.2rem;
          height: 1px;
          background: currentColor;
          transition: width 0.3s ease;
          flex-shrink: 0;
        }

        /* ── Nav dots ── */
        .sh-nav-dots {
          position: fixed;
          right: clamp(0.75rem, 2.5vw, 2.5rem);
          top: 50%;
          transform: translateY(-50%);
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: clamp(0.5rem, 1vh, 1rem);
          transition: opacity 0.5s ease;
        }
        .sh-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(255,255,255,.30);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: height 0.3s ease, border-radius 0.3s ease, background 0.3s ease, width 0.3s ease;
          position: relative;
        }
        .sh-dot::after {
          content: '';
          position: absolute;
          inset: -8px;
        }
        .sh-dot.active {
          height: 24px;
          border-radius: 2px;
          background: #fff;
        }
        @media (max-width: 360px) {
          .sh-dot { width: 3px; height: 3px; }
          .sh-dot.active { height: 18px; }
        }

        /* ── Staggered entrance animations ── */
        @keyframes sh-up {
          from { opacity: 0; transform: translateY(var(--dy, 20px)); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sh-a1 { opacity: 0; animation: sh-up 0.8s 0.20s forwards ease-out; --dy: 14px; }
        .sh-a2 { opacity: 0; animation: sh-up 0.9s 0.36s forwards ease-out; --dy: 22px; }
        .sh-a3 { opacity: 0; animation: sh-up 0.9s 0.50s forwards ease-out; --dy: 18px; }
        .sh-a4 { opacity: 0; animation: sh-up 0.8s 0.64s forwards ease-out; --dy: 14px; }

        @media (prefers-reduced-motion: reduce) {
          .sh-a1, .sh-a2, .sh-a3, .sh-a4 {
            animation: none;
            opacity: 1;
          }
          .sh-video { transform: scale(1) !important; transition: none; }
          .sh-btn::before { transition: none; }
          .sh-dot { transition: none; }
        }
      `}</style>

            {/* ── Nav Dots (fixed, outside scroll container) ── */}
            <div
                className="sh-nav-dots"
                style={{ opacity: showDots ? 1 : 0, pointerEvents: showDots ? "auto" : "none" }}
            >
                {sections.map((_, i) => (
                    <button
                        key={i}
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => scrollToSection(i)}
                        className={`sh-dot${activeIndex === i ? " active" : ""}`}
                    />
                ))}
            </div>

            {sections.map((section, i) => (
                    <section
                        key={section.id}
                        ref={(el) => { sectionRefs.current[i] = el; }}
                        className="sh-snap-section"
                        style={{ "--accent": section.accent } as React.CSSProperties}
                    >
                        {/* Video background */}
                        <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="sh-video"
                            aria-hidden="true"
                        >
                            <source src={section.video} type="video/mp4" />
                        </video>

                        {/* Gradient overlay */}
                        <div className="sh-overlay" aria-hidden="true" />

                        {/* Left decorative line */}
                        <div className="sh-deco-line" aria-hidden="true" />

                        {/* Section counter */}
                        <div className="sh-counter" aria-hidden="true">
                            0{section.id} — 0{sections.length}
                        </div>

                        {/* ── Animated content block ── */}
                        <div key={`${animKey}-${i}`} className="sh-content">
                            <p className="sh-eyebrow sh-a1">
                                <span className="sh-eyebrow-line" aria-hidden="true" />
                                {section.eyebrow}
                            </p>

                            <h1 className="sh-title sh-a2">
                                {section.title.map((line, j) => (
                                    <span key={j} style={{ display: "block" }}>
                    {j === 0 ? (
                        <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
                            {line}
                        </em>
                    ) : (
                        line
                    )}
                  </span>
                                ))}
                            </h1>

                            <p className="sh-description sh-a3">{section.description}</p>

                            <button className="sh-btn sh-a4">
                <span style={{ position: "relative", zIndex: 1 }}>
                  {section.button}
                </span>
                                <span className="sh-arrow" aria-hidden="true" />
                            </button>
                        </div>
                    </section>
                ))}
        </div>
    );
};

export default ScrollHero;