"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { gsap } from "gsap";
import Image from "next/image";
import Link from "next/link";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const slides = [
  {
    id: 1,
    image: "/images/ab1.png",
    eyebrow: "Heritage Collection",
    title: ["Handcrafted", "Jade Jewelry"],
    description:
      "Each piece is carefully made by skilled artisans with over 30 years of experience.",
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
    description:
      "We hand-select every stone for its color, clarity, and natural beauty.",
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
    description:
      "Discover our newest designs — simple, beautiful jewelry for everyday wear.",
    button: "See New Arrivals",
    accent: "#B8A9C9",
    accentRgb: "184, 169, 201",
    number: "03",
  },
];

const DURATION_SECONDS = 5;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ScrollHero() {
  const [current, setCurrent] = useState(0);
  const backgroundRefs = useRef<Array<HTMLDivElement | null>>([]);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const progressRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const autoplayTweenRef = useRef<gsap.core.Tween | null>(null);
  const transitionTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const directionRef = useRef<1 | -1>(1);

  const total = slides.length;
  const activeSlide = slides[current];

  const goTo = useCallback(
    (index: number) => {
      const normalized = ((index % total) + total) % total;
      setCurrent((prev) => {
        if (normalized !== prev) {
          const forwardDistance = (normalized - prev + total) % total;
          const backwardDistance = (prev - normalized + total) % total;
          directionRef.current = forwardDistance <= backwardDistance ? 1 : -1;
        }
        return normalized;
      });
    },
    [total],
  );

  const next = useCallback(() => {
    directionRef.current = 1;
    setCurrent((prev) => (prev + 1) % total);
  }, [total]);

  const back = useCallback(() => {
    directionRef.current = -1;
    setCurrent((prev) => (prev - 1 + total) % total);
  }, [total]);

  useLayoutEffect(() => {
    autoplayTweenRef.current?.kill();
    transitionTimelineRef.current?.kill();

    const reducedMotion = prefersReducedMotion();
    const activeBackground = backgroundRefs.current[current];
    const activeContent = contentRefs.current[current];
    const direction = directionRef.current;

    if (!activeBackground || !activeContent) return;

    const revealTargets = Array.from(
      activeContent.querySelectorAll<HTMLElement>("[data-hero-reveal]"),
    );

    /* z-index setup */
    backgroundRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.killTweensOf(el);
      gsap.set(el, { zIndex: i === current ? 2 : 1 });
    });

    contentRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.killTweensOf(el);
      gsap.set(el, { zIndex: i === current ? 4 : 3 });
    });

    progressRefs.current.forEach((el) => {
      if (!el) return;
      gsap.killTweensOf(el);
      gsap.set(el, { scaleX: 0, transformOrigin: "left center" });
    });

    /* reduced motion fallback */
    if (reducedMotion) {
      backgroundRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.set(el, { autoAlpha: i === current ? 1 : 0, scale: 1 });
      });
      contentRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.set(el, { autoAlpha: i === current ? 1 : 0 });
      });
      const activeBar = progressRefs.current[current];
      if (activeBar) gsap.set(activeBar, { scaleX: 1, transformOrigin: "left center" });

      autoplayTweenRef.current = gsap.delayedCall(DURATION_SECONDS, () => {
        directionRef.current = 1;
        setCurrent((prev) => (prev + 1) % total);
      });
      return () => { autoplayTweenRef.current?.kill(); };
    }

    /* ── Build transition timeline ── */
    const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    transitionTimelineRef.current = tl;

    /* Background: smooth crossfade with gentle Ken Burns */
    backgroundRefs.current.forEach((el, i) => {
      if (!el) return;

      if (i === current) {
        tl.fromTo(
          el,
          { autoAlpha: 0, scale: 1.06 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 1.2,
            ease: "power3.out",
          },
          0,
        );
      } else {
        tl.to(
          el,
          {
            autoAlpha: 0,
            scale: 1.04,
            duration: 0.8,
            ease: "power2.inOut",
          },
          0,
        );
      }
    });

    /* Old content: fade out quickly */
    contentRefs.current.forEach((el, i) => {
      if (!el || i === current) return;
      tl.to(el, { autoAlpha: 0, duration: 0.3, ease: "power2.out" }, 0);
    });

    /* New content: elegant staggered entrance */
    gsap.set(revealTargets, { autoAlpha: 0, y: 30 });

    tl.fromTo(
      activeContent,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.4, ease: "power2.out" },
      0.25,
    ).to(
      revealTargets,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "expo.out",
        clearProps: "transform,opacity",
      },
      0.35,
    );

    /* Progress bar */
    const activeBar = progressRefs.current[current];
    autoplayTweenRef.current = activeBar
      ? gsap.to(activeBar, {
          scaleX: 1,
          duration: DURATION_SECONDS,
          ease: "none",
          onComplete: () => {
            directionRef.current = 1;
            setCurrent((prev) => (prev + 1) % total);
          },
        })
      : gsap.delayedCall(DURATION_SECONDS, () => {
          directionRef.current = 1;
          setCurrent((prev) => (prev + 1) % total);
        });

    return () => {
      autoplayTweenRef.current?.kill();
      transitionTimelineRef.current?.kill();
    };
  }, [current, total]);

  useEffect(() => {
    return () => {
      autoplayTweenRef.current?.kill();
      transitionTimelineRef.current?.kill();
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Background images */}
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(node) => { backgroundRefs.current[index] = node; }}
            className="absolute inset-0"
          >
            <div
              className="absolute inset-0 z-10"
              style={{
                background: `radial-gradient(circle at 78% 24%, rgba(${slide.accentRgb}, 0.22), transparent 30%), radial-gradient(circle at 18% 80%, rgba(${slide.accentRgb}, 0.10), transparent 30%)`,
              }}
            />
            <Image
              src={slide.image}
              alt={slide.title.join(" ")}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Content slides */}
      <div className="absolute inset-0 z-20">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(node) => { contentRefs.current[index] = node; }}
            aria-hidden={index !== current}
            className="absolute inset-0 flex items-center justify-center px-6 md:justify-start md:px-20"
            style={{
              pointerEvents: index === current ? "auto" : "none",
              ["--accent" as string]: slide.accent,
            }}
          >
            <div className="max-w-xl text-center md:text-left">
              <p
                data-hero-reveal
                className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/50 md:text-xs"
              >
                {slide.eyebrow}
              </p>

              <div className="mt-4 space-y-1">
                {slide.title.map((line, lineIndex) => (
                  <span
                    key={line}
                    data-hero-reveal
                    className="block text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl"
                  >
                    {lineIndex === 0 ? (
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
              </div>

              <p
                data-hero-reveal
                className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-white/65 md:mx-0 md:text-base"
              >
                {slide.description}
              </p>

              <div
                data-hero-reveal
                className="mt-7 flex flex-col items-center gap-5 md:items-start"
              >
                <Link
                  href="/products"
                  data-home-hover="hero-cta"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-medium tracking-[0.08em] text-black shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition-all duration-300 hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {slide.button}
                </Link>

                <div className="flex items-center gap-4 text-white/50">
                  <span className="text-sm tracking-[0.35em]">{slide.number}</span>
                  <span
                    className="h-px w-16"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                  <span className="text-[11px] uppercase tracking-[0.26em]">
                    Jade Palace
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-6 md:px-20 md:pb-8">
        <div className="flex items-center gap-4 md:gap-6">
          <button
            onClick={back}
            data-home-hover="hero-control"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/60 backdrop-blur-sm transition-colors duration-200 hover:border-white/40 hover:text-white md:h-10 md:w-10"
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex flex-1 gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goTo(index)}
                data-home-hover="hero-progress"
                className="relative flex-1 overflow-hidden bg-white/15 transition-opacity duration-300 hover:opacity-100"
                aria-label={`Go to slide ${index + 1}`}
              >
                <span className="block h-[2px] w-full" />
                <span
                  ref={(node) => { progressRefs.current[index] = node; }}
                  className="absolute inset-y-0 left-0 right-0"
                  style={{
                    backgroundColor: slide.accent,
                    transform: "scaleX(0)",
                    transformOrigin: "left center",
                  }}
                />
              </button>
            ))}
          </div>

          <div className="hidden min-w-[100px] flex-col items-end text-right md:flex">
            <span className="text-[10px] uppercase tracking-[0.38em] text-white/30">
              Slide
            </span>
            <span className="mt-1 text-sm tracking-[0.28em] text-white/60">
              {activeSlide.number}
            </span>
          </div>

          <button
            onClick={next}
            data-home-hover="hero-control"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/60 backdrop-blur-sm transition-colors duration-200 hover:border-white/40 hover:text-white md:h-10 md:w-10"
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
