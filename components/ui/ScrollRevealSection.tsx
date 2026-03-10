"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";

type ScrollRevealSectionProps = {
  children: React.ReactNode;
  className?: string;
  itemSelector?: string;
  start?: string;
  stagger?: number;
  y?: number;
  duration?: number;
};

export default function ScrollRevealSection({
  children,
  className = "",
  itemSelector = "[data-scroll-reveal]",
  start = "top 78%",
  stagger = 0.12,
  y = 56,
  duration = 0.95,
}: ScrollRevealSectionProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const targets = Array.from(
        root.querySelectorAll<HTMLElement>(itemSelector),
      );

      if (!targets.length) {
        gsap.fromTo(
          root,
          {
            autoAlpha: 0,
            y,
            filter: "blur(12px)",
          },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration,
            ease: "power3.out",
            clearProps: "transform,filter,opacity",
            scrollTrigger: {
              trigger: root,
              start,
              once: true,
              toggleActions: "play none none none",
            },
          },
        );
        return;
      }

      gsap.set(targets, {
        autoAlpha: 0,
        y,
        filter: "blur(12px)",
        willChange: "transform, opacity, filter",
      });

      gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start,
          once: true,
          toggleActions: "play none none none",
        },
      }).to(targets, {
        autoAlpha: 1,
        y: 0,
        filter: "blur(0px)",
        duration,
        stagger,
        ease: "power3.out",
        clearProps: "transform,opacity,filter,willChange",
      });
    }, root);

    return () => {
      ctx.revert();
    };
  }, [duration, itemSelector, stagger, start, y]);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
