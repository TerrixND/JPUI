"use client";

import Image from "next/image";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

type PageEntranceLoaderProps = {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  className?: string;
};

export default function PageEntranceLoader({
  children,
  title,
  eyebrow = "Jade Palace",
  subtitle,
  className = "",
}: PageEntranceLoaderProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const topPanelRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const logoAuraRef = useRef<HTMLDivElement | null>(null);
  const logoWrapRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const overlay = overlayRef.current;
    const topPanel = topPanelRef.current;
    const bottomPanel = bottomPanelRef.current;
    const logoAura = logoAuraRef.current;
    const logoWrap = logoWrapRef.current;
    const copy = copyRef.current;
    const content = contentRef.current;

    if (!root || !overlay || !topPanel || !bottomPanel || !logoAura || !logoWrap || !copy || !content) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    let overflowRestored = false;

    const restoreOverflow = () => {
      if (overflowRestored) return;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      overflowRestored = true;
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const ctx = gsap.context(() => {
      const revealTargets = Array.from(content.querySelectorAll<HTMLElement>("[data-page-intro]"));
      const targets = revealTargets.length ? revealTargets : (Array.from(content.children) as HTMLElement[]);
      const animatedTargets = targets.length ? targets : [content];

      if (prefersReducedMotion) {
        gsap.set(animatedTargets, { autoAlpha: 1, clearProps: "all" });
        gsap.set(overlay, { display: "none", autoAlpha: 0 });
        restoreOverflow();
        return;
      }

      gsap.set(animatedTargets, { autoAlpha: 1, clearProps: "all" });

      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          onComplete: () => {
            gsap.set(overlay, { display: "none" });
            restoreOverflow();
          },
        })
        .fromTo(logoAura, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 1.2 })
        .fromTo(logoWrap, { autoAlpha: 0, scale: 0.82, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 1.0 }, "-=0.9")
        .fromTo(copy, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.55")
        .addLabel("hold", "+=0.6")
        .to(logoAura, { scale: 1.2, autoAlpha: 0, duration: 0.5, ease: "power2.in" }, "hold")
        .to(logoWrap, { autoAlpha: 0, y: -100, duration: 0.4, ease: "power2.in" }, "hold+=0.05")
        .to(copy, { autoAlpha: 0, y: 16, duration: 0.35, ease: "power2.in" }, "hold+=0.05")
        .to(topPanel, { yPercent: -102, duration: 0.35, ease: "power4.inOut" })
        .to(bottomPanel, { yPercent: 102, duration: 0.35, ease: "power4.inOut" }, "<")
        .to(overlay, { autoAlpha: 0, duration: 0.3 }, "-=0.25");
    }, root);

    return () => {
      restoreOverflow();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[120] overflow-hidden"
        style={{ backgroundColor: "#07090a" }}
      >
        {/* Gentle warmth in the center */}
        

        {/* Split panels */}
        <div
          ref={topPanelRef}
          className="absolute inset-x-0 top-0 h-1/2"
          style={{ backgroundColor: "#07090a" }}
        />
        <div
          ref={bottomPanelRef}
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{ backgroundColor: "#07090a" }}
        />

        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="relative flex flex-col items-center">

            {/* Aura */}
            <div
              ref={logoAuraRef}
              className="absolute"
              style={{
                width: 280,
                height: 280,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(168,136,64,0.15) 0%, rgba(16,58,44,0.12) 50%, transparent 72%)",
                filter: "blur(28px)",
              }}
            />

            {/* Logo */}
            <div ref={logoWrapRef} className="relative" style={{ width: 112, height: 112 }}>
              <Image
                src="/Jade-Palace-LOGO/noBgLogo.svg"
                alt="Jade Palace"
                fill
                priority
                className="object-contain"
                style={{ filter: "drop-shadow(0 0 20px rgba(200,168,88,0.2))" }}
              />
            </div>

            {/* Copy */}
            <div
              ref={copyRef}
              className="relative mt-9 flex flex-col items-center text-center"
            >
              <p
                style={{
                  fontFamily: "'Cormorant Garamond', 'Garamond', serif",
                  fontSize: 10,
                  letterSpacing: "0.5em",
                  textTransform: "uppercase",
                  color: "rgba(190,158,80,0.7)",
                  fontWeight: 500,
                }}
              >
                {eyebrow}
              </p>

              <h1
                className="mt-4"
                style={{
                  fontFamily: "'Cormorant Garamond', 'Cormorant', 'Garamond', serif",
                  fontSize: "clamp(2.4rem, 6.5vw, 4rem)",
                  fontWeight: 300,
                  letterSpacing: "0.18em",
                  lineHeight: 1.1,
                  color: "#ede0c4",
                }}
              >
                {title}
              </h1>

              {subtitle && (
                <p
                  className="mt-4"
                  style={{
                    fontFamily: "'Cormorant Garamond', 'Garamond', serif",
                    fontSize: 11,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    lineHeight: 2,
                    color: "rgba(195,180,148,0.55)",
                    maxWidth: 320,
                  }}
                >
                  {subtitle}
                </p>
              )}

              {/* Single thin gold rule */}
              <div
                className="mt-6"
                style={{
                  width: 80,
                  height: 1,
                  background:
                    "linear-gradient(90deg, transparent, rgba(180,148,72,0.8), transparent)",
                }}
              />
            </div>

          </div>
        </div>
      </div>

      <div ref={contentRef}>{children}</div>
    </div>
  );
}