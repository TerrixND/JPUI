"use client";

import { gsap } from "gsap";
import React, { useLayoutEffect, useRef, useState } from "react";

export default function ContactPage() {
  const rootRef = useRef<HTMLElement | null>(null);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const formCard = formCardRef.current;

    if (!root || !formCard) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const inputCleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      gsap.set(formCard, {
        transformPerspective: 1400,
        transformStyle: "preserve-3d",
      });

      const introTimeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      introTimeline
        .fromTo(
          "[data-contact-frame]",
          {
            autoAlpha: 0,
            scaleX: 0,
            transformOrigin: "left center",
          },
          {
            autoAlpha: 1,
            scaleX: 1,
            duration: 1.15,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0,
        )
        .fromTo(
          "[data-contact-orbit]",
          {
            autoAlpha: 0,
            scale: 0.72,
            xPercent: -8,
            yPercent: 12,
          },
          {
            autoAlpha: 1,
            scale: 1,
            xPercent: 0,
            yPercent: 0,
            duration: 1.4,
            stagger: 0.1,
            clearProps: "transform,opacity",
          },
          0.05,
        )
        .fromTo(
          "[data-contact-heading-row]",
          {
            autoAlpha: 0,
            y: 40,
            skewY: 5,
            clipPath: "inset(0 0 100% 0)",
          },
          {
            autoAlpha: 1,
            y: 0,
            skewY: 0,
            clipPath: "inset(0 0 0% 0)",
            duration: 1.05,
            stagger: 0.14,
            ease: "expo.out",
            clearProps: "transform,opacity,clipPath",
          },
          0.15,
        )
        .fromTo(
          "[data-contact-copy]",
          {
            autoAlpha: 0,
            y: 26,
            letterSpacing: "0.08em",
            filter: "blur(10px)",
          },
          {
            autoAlpha: 1,
            y: 0,
            letterSpacing: "0em",
            filter: "blur(0px)",
            duration: 0.95,
            stagger: 0.12,
            clearProps: "transform,opacity,filter,letterSpacing",
          },
          0.42,
        )
        .fromTo(
          "[data-contact-detail]",
          {
            autoAlpha: 0,
            x: -24,
          },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.7,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0.56,
        )
        .fromTo(
          formCard,
          {
            autoAlpha: 0,
            y: 72,
            rotateX: 12,
            rotateZ: -2,
            clipPath: "inset(10% 6% 18% 6% round 32px)",
            boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
          },
          {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            rotateZ: 0,
            clipPath: "inset(0% 0% 0% 0% round 32px)",
            boxShadow: "0 40px 120px rgba(17, 24, 39, 0.12)",
            duration: 1.25,
            ease: "expo.out",
            clearProps: "opacity,clipPath,boxShadow",
          },
          0.26,
        )
        .fromTo(
          "[data-contact-field]",
          {
            autoAlpha: 0,
            y: 26,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
            stagger: 0.12,
            clearProps: "transform,opacity",
          },
          0.68,
        )
        .fromTo(
          "[data-contact-field-line]",
          {
            scaleX: 0,
            transformOrigin: "left center",
          },
          {
            scaleX: 1,
            duration: 1,
            stagger: 0.12,
            clearProps: "transform",
          },
          0.75,
        )
        .fromTo(
          "[data-contact-button]",
          {
            autoAlpha: 0,
            y: 22,
            scale: 0.96,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.82,
            clearProps: "transform,opacity",
          },
          1.04,
        );

      gsap.utils
        .toArray<HTMLElement>("[data-contact-orbit]")
        .forEach((orbit, index) => {
          gsap.to(orbit, {
            xPercent: index % 2 === 0 ? 5 : -4,
            yPercent: index % 2 === 0 ? -6 : 7,
            rotate: index % 2 === 0 ? 8 : -10,
            duration: 7 + index * 1.1,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });

      gsap.utils
        .toArray<HTMLElement>("[data-contact-input-wrap]")
        .forEach((field) => {
          const input = field.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            "input, textarea",
          );
          const activeLine =
            field.querySelector<HTMLElement>("[data-contact-active-line]");
          const label = field.querySelector<HTMLElement>("[data-contact-label]");

          if (!input || !activeLine || !label) {
            return;
          }

          const syncFieldState = () => {
            const hasValue = input.value.trim().length > 0;
            gsap.to(activeLine, {
              scaleX: hasValue ? 1 : 0,
              duration: hasValue ? 0.35 : 0.28,
              ease: "power2.out",
              overwrite: "auto",
            });
            gsap.to(label, {
              x: hasValue ? 6 : 0,
              color: hasValue ? "#166534" : "#737373",
              duration: 0.35,
              ease: "power2.out",
              overwrite: "auto",
            });
          };

          const handleFocus = () => {
            gsap.to(activeLine, {
              scaleX: 1,
              duration: 0.42,
              ease: "power3.out",
              overwrite: "auto",
            });
            gsap.to(label, {
              x: 6,
              color: "#166534",
              duration: 0.38,
              ease: "power2.out",
              overwrite: "auto",
            });
          };

          const handleBlur = () => {
            syncFieldState();
          };

          syncFieldState();
          input.addEventListener("focus", handleFocus);
          input.addEventListener("blur", handleBlur);

          inputCleanups.push(() => {
            input.removeEventListener("focus", handleFocus);
            input.removeEventListener("blur", handleBlur);
          });
        });

      const rotateXTo = gsap.quickTo(formCard, "rotateX", {
        duration: 0.6,
        ease: "power3.out",
      });
      const rotateYTo = gsap.quickTo(formCard, "rotateY", {
        duration: 0.6,
        ease: "power3.out",
      });
      const glowXTo = gsap.quickTo("[data-contact-glow]", "x", {
        duration: 0.8,
        ease: "power3.out",
      });
      const glowYTo = gsap.quickTo("[data-contact-glow]", "y", {
        duration: 0.8,
        ease: "power3.out",
      });

      const handlePointerMove = (event: PointerEvent) => {
        const rect = formCard.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;

        rotateXTo(-y * 6);
        rotateYTo(x * 7);
        glowXTo(x * 42);
        glowYTo(y * 30);
      };

      const handlePointerLeave = () => {
        rotateXTo(0);
        rotateYTo(0);
        glowXTo(0);
        glowYTo(0);
      };

      formCard.addEventListener("pointermove", handlePointerMove);
      formCard.addEventListener("pointerleave", handlePointerLeave);
      inputCleanups.push(() => {
        formCard.removeEventListener("pointermove", handlePointerMove);
        formCard.removeEventListener("pointerleave", handlePointerLeave);
      });
    }, root);

    return () => {
      inputCleanups.forEach((cleanup) => cleanup());
      ctx.revert();
    };
  }, []);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Message sent successfully.");
      setForm({ name: "", email: "", message: "" });
    } catch {
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      ref={rootRef}
      className="relative min-h-screen overflow-hidden bg-[#f8f7f3] text-neutral-900"
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          data-contact-frame
          className="absolute left-0 top-0 h-px w-full bg-neutral-300/70"
        />
        <div
          data-contact-frame
          className="absolute bottom-0 left-0 h-px w-full bg-neutral-300/70"
        />
        <div
          data-contact-frame
          className="absolute left-6 top-0 hidden h-full w-px bg-neutral-200/80 sm:block"
        />
        <div
          data-contact-frame
          className="absolute right-6 top-0 hidden h-full w-px bg-neutral-200/80 sm:block"
        />

        <div
          data-contact-orbit
          className="absolute left-[-8rem] top-20 h-72 w-72 rounded-full border border-emerald-300/40 bg-emerald-200/15 blur-sm"
        />
        <div
          data-contact-orbit
          className="absolute right-[-5rem] top-28 h-52 w-52 rounded-full border border-neutral-300/60"
        />
        <div
          data-contact-orbit
          className="absolute bottom-[-7rem] left-[22%] h-64 w-64 rounded-full border border-amber-200/70 bg-amber-100/30 blur-2xl"
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(17,24,39,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,24,39,0.16) 1px, transparent 1px)",
            backgroundSize: "120px 120px",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl gap-20 px-6 py-24 sm:px-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-20 lg:py-28">
        <div className="flex flex-col justify-center">
          <p
            data-contact-copy
            className="mb-6 text-xs uppercase tracking-[0.42em] text-neutral-500"
          >
            Contact
          </p>

          <div className="space-y-2">
            <div className="overflow-hidden">
              <h1
                data-contact-heading-row
                className="text-5xl font-light leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl"
              >
                Let&apos;s Build
              </h1>
            </div>
            <div className="overflow-hidden">
              <h1
                data-contact-heading-row
                className="text-5xl font-light leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl"
              >
                Something Timeless.
              </h1>
            </div>
          </div>

          <p
            data-contact-copy
            className="mt-8 max-w-xl text-lg leading-relaxed text-neutral-600"
          >
            We value refined conversations and meaningful collaborations. Share
            your thoughts with us, and our team will respond with clarity,
            discretion, and precision.
          </p>

          <div className="mt-12 space-y-5">
            <div data-contact-detail className="flex items-center gap-4">
              <span className="h-px w-10 bg-neutral-400" />
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                Private Inquiries
              </p>
            </div>
            <div data-contact-detail className="space-y-2 text-neutral-700">
              <p className="text-base">info@jadepalacept.com</p>
              <p className="text-base">+95 (1) 500-1148</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center lg:justify-end">
          <div
            ref={formCardRef}
            className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/70 bg-white/82 p-8 shadow-[0_35px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10"
          >
            <div
              data-contact-glow
              className="pointer-events-none absolute left-1/2 top-12 h-40 w-40 -translate-x-1/2 rounded-full bg-emerald-100/80 blur-3xl"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-tr-[48px] border-r border-t border-neutral-200/80" />

            <form onSubmit={handleSubmit} className="relative space-y-10">
              <div data-contact-field data-contact-input-wrap className="relative">
                <label
                  data-contact-label
                  className="mb-3 block text-sm tracking-[0.24em] uppercase text-neutral-500"
                >
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full bg-transparent pb-4 text-xl text-neutral-900 outline-none"
                />
                <div
                  data-contact-field-line
                  className="h-px w-full bg-neutral-200"
                />
                <div
                  data-contact-active-line
                  className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-emerald-700"
                />
              </div>

              <div data-contact-field data-contact-input-wrap className="relative">
                <label
                  data-contact-label
                  className="mb-3 block text-sm tracking-[0.24em] uppercase text-neutral-500"
                >
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full bg-transparent pb-4 text-xl text-neutral-900 outline-none"
                />
                <div
                  data-contact-field-line
                  className="h-px w-full bg-neutral-200"
                />
                <div
                  data-contact-active-line
                  className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-emerald-700"
                />
              </div>

              <div data-contact-field data-contact-input-wrap className="relative">
                <label
                  data-contact-label
                  className="mb-3 block text-sm tracking-[0.24em] uppercase text-neutral-500"
                >
                  Message
                </label>
                <textarea
                  name="message"
                  rows={5}
                  required
                  value={form.message}
                  onChange={handleChange}
                  className="w-full resize-none bg-transparent pb-4 text-xl text-neutral-900 outline-none"
                />
                <div
                  data-contact-field-line
                  className="h-px w-full bg-neutral-200"
                />
                <div
                  data-contact-active-line
                  className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-emerald-700"
                />
              </div>

              <div data-contact-button className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-900 bg-neutral-900 px-8 py-3 text-sm uppercase tracking-[0.28em] text-white transition-colors duration-300 hover:bg-transparent hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
