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

    if (
      !root ||
      !overlay ||
      !topPanel ||
      !bottomPanel ||
      !logoAura ||
      !logoWrap ||
      !copy ||
      !content
    ) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    let overflowRestored = false;

    const restoreOverflow = () => {
      if (overflowRestored) {
        return;
      }

      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      overflowRestored = true;
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const ctx = gsap.context(() => {
      const revealTargets = Array.from(
        content.querySelectorAll<HTMLElement>("[data-page-intro]"),
      );
      const targets = revealTargets.length
        ? revealTargets
        : Array.from(content.children) as HTMLElement[];
      const animatedTargets = targets.length ? targets : [content];

      if (prefersReducedMotion) {
        gsap.set(animatedTargets, {
          autoAlpha: 1,
          clearProps: "all",
        });
        gsap.set(overlay, {
          display: "none",
          autoAlpha: 0,
        });
        restoreOverflow();
        return;
      }

      gsap.set(animatedTargets, {
        autoAlpha: 0,
        y: 42,
      });

      gsap
        .timeline({
          defaults: {
            ease: "power3.out",
          },
          onComplete: () => {
            gsap.set(overlay, {
              display: "none",
            });
            restoreOverflow();
          },
        })
        .fromTo(
          logoAura,
          {
            autoAlpha: 0,
            scale: 0.68,
          },
          {
            autoAlpha: 0.95,
            scale: 1.06,
            duration: 1.05,
          },
        )
        .fromTo(
          logoWrap,
          {
            autoAlpha: 0,
            scale: 0.72,
            y: 24,
            rotate: -8,
          },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            rotate: 0,
            duration: 1.05,
          },
          "-=0.8",
        )
        .fromTo(
          copy,
          {
            autoAlpha: 0,
            y: 18,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
          },
          "-=0.62",
        )
        .to(
          logoAura,
          {
            scale: 1.18,
            autoAlpha: 0.25,
            duration: 0.5,
          },
          "+=0.1",
        )
        .to(
          topPanel,
          {
            yPercent: -102,
            duration: 1.08,
            ease: "power4.inOut",
          },
        )
        .to(
          bottomPanel,
          {
            yPercent: 102,
            duration: 1.08,
            ease: "power4.inOut",
          },
          "<",
        )
        .to(
          logoWrap,
          {
            autoAlpha: 0,
            y: -26,
            duration: 0.44,
            ease: "power2.in",
          },
          "<0.06",
        )
        .to(
          copy,
          {
            autoAlpha: 0,
            y: 20,
            duration: 0.38,
            ease: "power2.in",
          },
          "<",
        )
        .to(
          overlay,
          {
            autoAlpha: 0,
            duration: 0.35,
          },
          "-=0.24",
        )
        .to(
          animatedTargets,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.12,
            ease: "power3.out",
            clearProps: "transform",
          },
          "-=0.05",
        );
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
        className="fixed inset-0 z-[120] overflow-hidden bg-[#050606]"
      >
        <div
          className="absolute inset-0 opacity-95"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, rgba(32, 130, 109, 0.24), transparent 24%), radial-gradient(circle at 50% 58%, rgba(246, 225, 176, 0.14), transparent 32%), linear-gradient(180deg, #040505 0%, #0b1110 100%)",
          }}
        />
        <div
          ref={topPanelRef}
          className="absolute inset-x-0 top-0 h-1/2 border-b border-emerald-200/10 bg-[#050606]"
        />
        <div
          ref={bottomPanelRef}
          className="absolute inset-x-0 bottom-0 h-1/2 border-t border-emerald-200/10 bg-[#050606]"
        />

        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="relative flex flex-col items-center">
            <div
              ref={logoAuraRef}
              className="absolute h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl sm:h-80 sm:w-80"
            />

            <div
              ref={logoWrapRef}
              className="relative h-28 w-28 sm:h-36 sm:w-36"
            >
              <Image
                src="/Jade-Palace-LOGO/noBgLogo.svg"
                alt="Jade Palace"
                fill
                priority
                className="object-contain drop-shadow-[0_0_24px_rgba(246,225,176,0.22)]"
              />
            </div>

            <div
              ref={copyRef}
              className="relative mt-8 flex max-w-xl flex-col items-center text-center"
            >
              <p className="text-[11px] uppercase tracking-[0.55em] text-emerald-100/70">
                {eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-light tracking-[0.14em] text-[#f4e7c7] sm:text-6xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-4 max-w-md text-sm leading-relaxed tracking-[0.18em] text-stone-300/80 uppercase">
                  {subtitle}
                </p>
              ) : null}
              <div className="mt-6 h-px w-28 bg-gradient-to-r from-transparent via-[#ddc18b] to-transparent sm:w-40" />
            </div>
          </div>
        </div>
      </div>

      <div ref={contentRef}>{children}</div>
    </div>
  );
}
