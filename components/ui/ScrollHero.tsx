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

    if (!activeBackground || !activeContent) {
      return;
    }

    const revealTargets = Array.from(
      activeContent.querySelectorAll<HTMLElement>("[data-hero-reveal]"),
    );

    backgroundRefs.current.forEach((element, index) => {
      if (!element) {
        return;
      }

      gsap.killTweensOf(element);
      gsap.set(element, {
        zIndex: index === current ? 2 : 1,
      });
    });

    contentRefs.current.forEach((element, index) => {
      if (!element) {
        return;
      }

      gsap.killTweensOf(element);
      gsap.set(element, {
        zIndex: index === current ? 4 : 3,
      });
    });

    progressRefs.current.forEach((element) => {
      if (!element) {
        return;
      }

      gsap.killTweensOf(element);
      gsap.set(element, {
        scaleX: 0,
        transformOrigin: "left center",
      });
    });

    if (reducedMotion) {
      backgroundRefs.current.forEach((element, index) => {
        if (!element) {
          return;
        }

        gsap.set(element, {
          autoAlpha: index === current ? 1 : 0,
          scale: index === current ? 1 : 1.06,
        });
      });

      contentRefs.current.forEach((element, index) => {
        if (!element) {
          return;
        }

        gsap.set(element, {
          autoAlpha: index === current ? 1 : 0,
        });
      });

      const activeBar = progressRefs.current[current];
      if (activeBar) {
        gsap.set(activeBar, {
          scaleX: 1,
          transformOrigin: "left center",
        });
      }

      autoplayTweenRef.current = gsap.delayedCall(DURATION_SECONDS, () => {
        directionRef.current = 1;
        setCurrent((prev) => (prev + 1) % total);
      });

      return () => {
        autoplayTweenRef.current?.kill();
      };
    }

    transitionTimelineRef.current = gsap.timeline({
      defaults: {
        ease: "power3.out",
      },
    });

    backgroundRefs.current.forEach((element, index) => {
      if (!element) {
        return;
      }

      if (index === current) {
        transitionTimelineRef.current?.fromTo(
          element,
          {
            autoAlpha: 0,
            scale: 1.18,
            xPercent: direction * 7,
            filter: "blur(10px)",
          },
          {
            autoAlpha: 1,
            scale: 1,
            xPercent: 0,
            filter: "blur(0px)",
            duration: 1.35,
          },
          0,
        );
        return;
      }

      transitionTimelineRef.current?.to(
        element,
        {
          autoAlpha: 0,
          scale: 1.08,
          xPercent: direction * -5,
          filter: "blur(6px)",
          duration: 0.9,
          ease: "power2.out",
        },
        0,
      );
    });

    contentRefs.current.forEach((element, index) => {
      if (!element || index === current) {
        return;
      }

      transitionTimelineRef.current?.to(
        element,
        {
          autoAlpha: 0,
          duration: 0.35,
          ease: "power2.out",
        },
        0,
      );
    });

    gsap.set(revealTargets, {
      autoAlpha: 0,
      y: 28,
      x: direction * 22,
      filter: "blur(10px)",
    });

    transitionTimelineRef.current
      ?.fromTo(
        activeContent,
        {
          autoAlpha: 0,
          x: direction * 18,
        },
        {
          autoAlpha: 1,
          x: 0,
          duration: 0.5,
        },
        0.12,
      )
      .to(
        revealTargets,
        {
          autoAlpha: 1,
          y: 0,
          x: 0,
          filter: "blur(0px)",
          duration: 0.9,
          stagger: 0.11,
        },
        0.2,
      );

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
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(node) => {
              backgroundRefs.current[index] = node;
            }}
            className="absolute inset-0"
          >
            <div
              className="absolute inset-0 z-10"
              style={{
                background: `radial-gradient(circle at 78% 24%, rgba(${slide.accentRgb}, 0.28), transparent 26%), radial-gradient(circle at 18% 80%, rgba(${slide.accentRgb}, 0.12), transparent 26%)`,
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

      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-black/72 via-black/42 to-black/12" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/65 via-transparent to-transparent" />

      <div className="absolute inset-0 z-20">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(node) => {
              contentRefs.current[index] = node;
            }}
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
                className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/55 md:text-xs"
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
                className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-white/72 md:mx-0 md:text-base"
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
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-medium tracking-[0.08em] text-black shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-all duration-300 hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {slide.button}
                </Link>

                <div className="flex items-center gap-4 text-white/55">
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

      <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-6 md:px-20 md:pb-8">
        <div className="flex items-center gap-4 md:gap-6">
          <button
            onClick={back}
            data-home-hover="hero-control"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/60 backdrop-blur-sm transition hover:text-white md:h-10 md:w-10"
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex flex-1 gap-1">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goTo(index)}
                data-home-hover="hero-progress"
                className="relative flex-1 overflow-hidden bg-white/18 transition-[opacity,transform] duration-300 hover:opacity-100"
                aria-label={`Go to slide ${index + 1}`}
              >
                <span className="block h-[2px] w-full" />
                <span
                  ref={(node) => {
                    progressRefs.current[index] = node;
                  }}
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
            <span className="text-[10px] uppercase tracking-[0.38em] text-white/35">
              Slide
            </span>
            <span className="mt-1 text-sm tracking-[0.28em] text-white/65">
              {activeSlide.number}
            </span>
          </div>

          <button
            onClick={next}
            data-home-hover="hero-control"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/60 backdrop-blur-sm transition hover:text-white md:h-10 md:w-10"
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
