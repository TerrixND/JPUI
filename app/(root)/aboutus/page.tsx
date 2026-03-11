"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";

/* ────────────────────────────────────────────
   Split text into wrapped lines for reveal
   ──────────────────────────────────────────── */
type SplitLineResult = {
  lines: HTMLSpanElement[];
  revert: () => void;
};

function splitElementLines(element: HTMLElement): SplitLineResult | null {
  const originalHtml = element.innerHTML;
  const text = element.textContent?.replace(/\s+/g, " ").trim();

  if (!text) return null;

  const words = text.split(" ");
  element.textContent = "";

  words.forEach((word, index) => {
    const wordSpan = document.createElement("span");
    wordSpan.textContent = index === words.length - 1 ? word : `${word}\u00A0`;
    wordSpan.style.display = "inline-block";
    element.appendChild(wordSpan);
  });

  const wordSpans = Array.from(element.children) as HTMLSpanElement[];

  if (!wordSpans.length) {
    element.innerHTML = originalHtml;
    return null;
  }

  const lineGroups: HTMLSpanElement[][] = [];
  let currentTop = wordSpans[0].offsetTop;

  wordSpans.forEach((wordSpan) => {
    if (Math.abs(wordSpan.offsetTop - currentTop) > 4) {
      lineGroups.push([]);
      currentTop = wordSpan.offsetTop;
    }
    if (!lineGroups.length) lineGroups.push([]);
    lineGroups[lineGroups.length - 1].push(wordSpan.cloneNode(true) as HTMLSpanElement);
  });

  element.textContent = "";

  const lines: HTMLSpanElement[] = [];
  lineGroups.forEach((group) => {
    const mask = document.createElement("span");
    mask.style.display = "block";
    mask.style.overflow = "hidden";

    const line = document.createElement("span");
    line.style.display = "block";
    line.style.willChange = "transform, opacity";

    group.forEach((wordSpan) => line.appendChild(wordSpan));
    mask.appendChild(line);
    element.appendChild(mask);
    lines.push(line);
  });

  return {
    lines,
    revert: () => { element.innerHTML = originalHtml; },
  };
}

/* ────────────────────────────────────────────
   Component
   ──────────────────────────────────────────── */
export default function AboutUs() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const values = [
    {
      title: "Authenticity",
      desc: "Every piece carries a GIA-aligned certificate traceable to its source in Hpakant, Kachin State, with full chain-of-custody documentation.",
    },
    {
      title: "Craftsmanship",
      desc: "Our 14 in-house artisans average 22 years of experience, preserving centuries-old Burmese jade-carving traditions alongside modern precision tools.",
    },
    {
      title: "Integrity",
      desc: "Transparent Mohs hardness grading, natural vs. treated disclosure, and market-rate pricing — no hidden markups, no high-pressure sales.",
    },
    {
      title: "Heritage",
      desc: "Proud stewards of Myanmar's most treasured natural gemstone, with active ties to Kachin mining cooperatives and the Hpakant Responsible Sourcing Accord since 2014.",
    },
  ];

  const team = [
    {
      name: "U Kelvin Aung",
      role: "Founder & Chairman",
      bio: "A third-generation gemstone trader from Mandalay, U Kelvin apprenticed under master cutter Saw Ba Thin before founding JadePalace in 1998. He holds a Fellow Gemologist diploma from the Gemological Institute of Asia.",
      since: "Est. 1998",
    },
    {
      name: "Daw Thin Zar Kyaw",
      role: "Head of Certification & Grading",
      bio: "Former senior grader at Myanmar Gems Enterprise (MGE), Daw Thin Zar brings 19 years of government-grade appraisal experience. She introduced our triple-blind grading protocol in 2014.",
      since: "Joined 2009",
    },
    {
      name: "Ko Pyae Sone Aung",
      role: "International Sales Director",
      bio: "Based between Yangon and Hong Kong, Ko Pyae Sone manages relationships with over 80 wholesale clients across Asia-Pacific and Europe, including three Royal Warrant holders.",
      since: "Joined 2015",
    },
    {
      name: "Ma Ei Phyu",
      role: "Master Carver & Workshop Lead",
      bio: "Trained under her grandfather in Mandalay's jade quarter, Ma Ei Phyu leads a team of 14 artisans specialising in Imperial cabochon cutting, bangle production, and bespoke sculptural commissions.",
      since: "Joined 2011",
    },
  ];

  const milestones = [
    { year: "1998", event: "Founded by U Kelvin Aung in Mandalay's jade quarter with 3 staff and a single workshop bench on 78th Street." },
    { year: "2003", event: "Secured first direct mining partnership with a Hpakant cooperative, ensuring traceable rough supply from mine to finished piece." },
    { year: "2007", event: "Opened Yangon flagship on Inya Road, Golden Valley. Expanded into retail alongside long-standing wholesale operations." },
    { year: "2011", event: "Achieved ISO 9001 certification for gemstone grading processes — the first jade company in Myanmar to do so." },
    { year: "2014", event: "Launched proprietary triple-blind grading protocol. Certified our 1,000th piece. Signed the Hpakant Responsible Sourcing Accord." },
    { year: "2018", event: "Established Hong Kong liaison office. Became an approved consignment supplier for Christie's and Bonhams Jewels & Jade auctions." },
    { year: "2022", event: "Introduced a blockchain-based provenance ledger for all pieces valued above THB 10,000. Certificate QR codes link to on-chain records." },
    { year: "2024", event: "26 years in business. 5,000+ certified pieces across 18 countries. Three generations of master artisans in our Mandalay workshop." },
  ];

  /* ── Animations ── */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const splitResults = new Map<HTMLElement, SplitLineResult>();

    const ctx = gsap.context(() => {

      /* ── Helper: clean line reveal (uniform upward, no blur chaos) ── */
      const revealLines = (
        tl: gsap.core.Timeline,
        el: HTMLElement,
        position: number | string,
      ) => {
        const split = splitResults.get(el);

        if (!split?.lines.length) {
          tl.fromTo(
            el,
            { autoAlpha: 0, y: 32 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.8,
              ease: "expo.out",
              clearProps: "transform,opacity",
            },
            position,
          );
          return;
        }

        tl.fromTo(
          split.lines,
          { autoAlpha: 0, y: "100%" },
          {
            autoAlpha: 1,
            y: "0%",
            duration: 0.7,
            stagger: 0.08,
            ease: "expo.out",
            clearProps: "transform,opacity",
          },
          position,
        );
      };

      /* ── Prepare split lines ── */
      gsap.utils.toArray<HTMLElement>("[data-about-lines]").forEach((el) => {
        const split = splitElementLines(el);
        if (split) splitResults.set(el, split);
      });

      /* ══════════════════════════════════════════
         HERO — elegant cascade
         ══════════════════════════════════════════ */
      const heroTl = gsap.timeline({ defaults: { ease: "expo.out" } });

      const heroItems = gsap.utils.toArray<HTMLElement>("[data-about-hero-item]");
      let heroPos = 0;

      heroItems.forEach((item) => {
        if (item.hasAttribute("data-about-hero-divider")) {
          heroTl.fromTo(
            item,
            { scaleX: 0, autoAlpha: 0 },
            {
              scaleX: 1,
              autoAlpha: 1,
              duration: 0.8,
              ease: "power2.inOut",
              clearProps: "transform,opacity",
            },
            heroPos,
          );
          heroPos += 0.15;
          return;
        }

        revealLines(heroTl, item, heroPos);
        heroPos += 0.18;
      });

      /* ══════════════════════════════════════════
         SCROLL SECTIONS — toggle-based, not scrub
         ══════════════════════════════════════════ */
      gsap.utils
        .toArray<HTMLElement>("[data-about-scrub-section]")
        .forEach((section) => {
          const textItems = Array.from(
            section.querySelectorAll<HTMLElement>("[data-about-text-item]"),
          );
          const imageContainer = section.querySelector<HTMLElement>("[data-about-image]");
          const parallaxImage = section.querySelector<HTMLElement>("[data-about-parallax]");

          /* text: staggered upward reveals */
          if (textItems.length) {
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: "top 80%",
                toggleActions: "play none none none",
              },
            });

            textItems.forEach((item, i) => {
              revealLines(tl, item, i * 0.12);
            });
          }

          /* image: smooth slide up + fade */
          if (imageContainer) {
            gsap.fromTo(
              imageContainer,
              { autoAlpha: 0, y: 60, scale: 1.03 },
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 1,
                ease: "power3.out",
                clearProps: "transform,opacity",
                scrollTrigger: {
                  trigger: imageContainer,
                  start: "top 85%",
                  toggleActions: "play none none none",
                },
              },
            );
          }

          /* parallax: subtle Ken Burns drift */
          if (parallaxImage) {
            gsap.fromTo(
              parallaxImage,
              { scale: 1.12, yPercent: 6 },
              {
                scale: 1.02,
                yPercent: -3,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              },
            );
          }
        });

      /* ══════════════════════════════════════════
         STAT CARDS — count-up + stagger rise
         ══════════════════════════════════════════ */
      const statCards = gsap.utils.toArray<HTMLElement>("[data-about-stat]");
      if (statCards.length) {
        gsap.fromTo(
          statCards,
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.1,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: statCards[0],
              start: "top 88%",
              toggleActions: "play none none none",
              onEnter: () => {
                /* animate the number values */
                statCards.forEach((card) => {
                  const numEl = card.querySelector<HTMLElement>("[data-about-stat-num]");
                  if (!numEl) return;

                  const raw = numEl.dataset.aboutStatNum || "";
                  const suffix = raw.replace(/[\d,]/g, "");
                  const target = parseInt(raw.replace(/\D/g, ""), 10);

                  if (isNaN(target)) return;

                  const proxy = { val: 0 };
                  gsap.to(proxy, {
                    val: target,
                    duration: 1.8,
                    ease: "power2.out",
                    onUpdate: () => {
                      numEl.textContent =
                        Math.round(proxy.val).toLocaleString() + suffix;
                    },
                  });
                });
              },
            },
          },
        );
      }

      /* ══════════════════════════════════════════
         MILESTONE CARDS — sequential timeline reveal
         ══════════════════════════════════════════ */
      const milestoneCards = gsap.utils.toArray<HTMLElement>("[data-about-milestone]");
      if (milestoneCards.length) {
        milestoneCards.forEach((card, i) => {
          const dot = card.querySelector<HTMLElement>("[data-about-milestone-dot]");
          const content = card.querySelector<HTMLElement>("[data-about-milestone-content]");

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          });

          if (dot) {
            tl.fromTo(
              dot,
              { scale: 0, autoAlpha: 0 },
              {
                scale: 1,
                autoAlpha: 1,
                duration: 0.4,
                ease: "back.out(2)",
                clearProps: "transform,opacity",
              },
              0,
            );
          }

          if (content) {
            tl.fromTo(
              content,
              { autoAlpha: 0, x: i % 2 === 0 ? -20 : 20, y: 12 },
              {
                autoAlpha: 1,
                x: 0,
                y: 0,
                duration: 0.6,
                ease: "power3.out",
                clearProps: "transform,opacity",
              },
              0.1,
            );
          }
        });
      }

      /* ══════════════════════════════════════════
         GENERIC CARDS — uniform upward reveals
         ══════════════════════════════════════════ */
      const cardGroups = gsap.utils.toArray<HTMLElement>("[data-about-card-group]");

      cardGroups.forEach((group) => {
        const cards = Array.from(group.querySelectorAll<HTMLElement>("[data-about-card]"));
        if (!cards.length) return;

        gsap.fromTo(
          cards,
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.08,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: group,
              start: "top 86%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      /* ══════════════════════════════════════════
         STANDALONE SPLIT-LINE HEADINGS
         ══════════════════════════════════════════ */
      const standaloneElements = Array.from(splitResults.keys()).filter(
        (el) =>
          !el.closest("[data-about-hero]") &&
          !el.closest("[data-about-scrub-section]"),
      );

      standaloneElements.forEach((el) => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        });
        revealLines(tl, el, 0);
      });

      /* ══════════════════════════════════════════
         SECTION DIVIDERS — width reveal
         ══════════════════════════════════════════ */
      gsap.utils.toArray<HTMLElement>("[data-about-divider]").forEach((el) => {
        gsap.fromTo(
          el,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.8,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      /* ══════════════════════════════════════════
         FOOTER — gentle rise
         ══════════════════════════════════════════ */
      const footer = root.querySelector<HTMLElement>("[data-about-footer]");
      if (footer) {
        gsap.fromTo(
          footer.children,
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.06,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: footer,
              start: "top 94%",
              toggleActions: "play none none none",
            },
          },
        );
      }
    }, root);

    return () => {
      ctx.revert();
      splitResults.forEach((split) => split.revert());
    };
  }, []);

  /* ════════════════════════════════════════════
     JSX
     ════════════════════════════════════════════ */
  return (
    <div ref={rootRef} className="min-h-screen bg-white text-gray-800">

      {/* ─── Hero ─── */}
      <section data-about-hero className="px-6 pt-28 pb-20 text-center sm:px-12 sm:pt-32 sm:pb-24 lg:px-20">
        <p
          data-about-hero-item
          data-about-lines
          className="mb-5 text-[11px] uppercase tracking-[0.3em] text-emerald-700"
        >
          Est. 1998 · Mandalay, Myanmar · MGE Licence No. MGE-2003-0471
        </p>

        <h1
          data-about-hero-item
          data-about-lines
          className="mb-6 text-4xl font-light leading-tight text-gray-900 sm:text-5xl"
        >
          About Us
        </h1>

        <div
          data-about-hero-item
          data-about-hero-divider
          className="mx-auto mb-8 h-px w-12 origin-center bg-emerald-600"
        />

        <p
          data-about-hero-item
          data-about-lines
          className="mx-auto max-w-3xl text-base leading-relaxed text-gray-500 sm:text-lg"
        >
          JadePalace Pt Co Ltd is Myanmar&apos;s trusted name in the sourcing,
          certification, and global trade of fine jadeite jade — from the mines
          of Hpakant to collectors around the world. Licensed under
          Myanmar&apos;s Gemstone Law (2019) and registered with the Myanmar
          Gems Enterprise.
        </p>
      </section>

      {/* ─── Story ─── */}
      <section className="border-t border-gray-100">
        <div className="px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
          <div
            data-about-scrub-section
            className="mb-16 grid items-center gap-10 md:grid-cols-2 md:gap-16"
          >
            <div>
              <p
                data-about-text-item
                data-about-lines
                className="mb-3 text-[11px] uppercase tracking-[0.25em] text-emerald-700"
              >
                Our Story
              </p>

              <h2
                data-about-text-item
                data-about-lines
                className="mb-6 text-2xl font-light text-gray-900 sm:text-3xl"
              >
                A Quarter Century of Excellence
              </h2>

              <p
                data-about-text-item
                data-about-lines
                className="mb-4 text-[15px] leading-relaxed text-gray-500"
              >
                Founded in 1998 by U Kelvin Aung in Mandalay, JadePalace began
                as a three-person workshop on 78th Street with a bold vision —
                to bring Myanmar&apos;s finest jadeite to the world with
                complete honesty and meticulous documentation at every step.
              </p>

              <p
                data-about-text-item
                data-about-lines
                className="mb-4 text-[15px] leading-relaxed text-gray-500"
              >
                In 2003 we formed our first direct mining partnership with a
                Hpakant cooperative in Kachin State, giving us unbroken
                chain-of-custody from rough stone to finished piece — a standard
                rare in the industry at that time.
              </p>

              <p
                data-about-text-item
                data-about-lines
                className="text-[15px] leading-relaxed text-gray-500"
              >
                Over 26 years we have grown into an internationally recognised
                house, trusted by jewellers, collectors, and auction houses from
                Hong Kong to New York. In 2011 we became the first Myanmar jade
                company to achieve ISO 9001 certification for gemstone grading
                processes.
              </p>
            </div>

            <div
              data-about-image
              className="relative min-h-[320px] w-full overflow-hidden bg-gray-100 sm:min-h-[400px]"
            >
              <Image
                src="/images/ab1.png"
                alt="Our Story at JadePalace"
                fill
                sizes="(min-width: 1024px) 42vw, 100vw"
                data-about-parallax
                className="object-cover"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {[
              { num: "26+", label: "Years in Business" },
              { num: "5,000+", label: "Pieces Certified" },
              { num: "18", label: "Countries Served" },
              { num: "80+", label: "Wholesale Clients" },
            ].map((s, i) => (
              <div
                key={i}
                data-about-stat
                className="border border-gray-100 p-5 sm:p-6"
              >
                <div
                  data-about-stat-num={s.num}
                  className="text-2xl font-light text-emerald-700 sm:text-3xl"
                >
                  {s.num}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-400 sm:text-xs">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Milestones ─── */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
          <p
            data-about-lines
            className="mb-2 text-[11px] uppercase tracking-[0.25em] text-emerald-700"
          >
            Company History
          </p>
          <h2
            data-about-lines
            className="mb-10 text-2xl font-light text-gray-900 sm:mb-14 sm:text-3xl"
          >
            Key Milestones
          </h2>

          {/* Timeline */}
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-3 top-0 hidden h-full w-px bg-gray-200 sm:block sm:left-4" />

            <div className="space-y-8 sm:space-y-10">
              {milestones.map((m, i) => (
                <div
                  key={i}
                  data-about-milestone
                  className="relative flex gap-5 sm:gap-8"
                >
                  {/* dot */}
                  <div className="relative z-10 flex shrink-0 items-start pt-1">
                    <div
                      data-about-milestone-dot
                      className="h-2 w-2 rounded-full bg-emerald-600 ring-4 ring-gray-50 sm:h-2.5 sm:w-2.5"
                    />
                  </div>

                  {/* content */}
                  <div data-about-milestone-content className="-mt-0.5 pb-2">
                    <span className="text-xs font-medium text-emerald-700">{m.year}</span>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Values ─── */}
      <section className="border-t border-gray-100">
        <div className="px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
          <p
            data-about-lines
            className="mb-2 text-[11px] uppercase tracking-[0.25em] text-emerald-700"
          >
            Our Principles
          </p>

          <h2
            data-about-lines
            className="mb-10 text-2xl font-light text-gray-900 sm:mb-14 sm:text-3xl"
          >
            What We Stand For
          </h2>

          <div data-about-card-group className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {values.map((v, i) => (
              <div key={i} data-about-card>
                <div data-about-divider className="mb-5 h-px w-8 origin-left bg-emerald-600" />
                <h3 className="mb-2 text-[15px] font-medium text-gray-900">{v.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Team ─── */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
          <p
            data-about-lines
            className="mb-2 text-[11px] uppercase tracking-[0.25em] text-emerald-700"
          >
            Leadership
          </p>
          <h2
            data-about-lines
            className="mb-10 text-2xl font-light text-gray-900 sm:mb-14 sm:text-3xl"
          >
            The People Behind JadePalace
          </h2>

          <div data-about-card-group className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {team.map((person, i) => (
              <div
                key={i}
                data-about-card
                className="rounded-xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md sm:p-6"
              >
                <p className="text-[10px] uppercase tracking-wider text-emerald-700">
                  {person.since}
                </p>
                <h3 className="mt-1 text-sm font-medium text-gray-900">{person.name}</h3>
                <p className="text-[11px] uppercase tracking-wider text-gray-400">
                  {person.role}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{person.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Certifications ─── */}
      <section className="border-t border-gray-100">
        <div className="px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
          <p
            data-about-lines
            className="mb-2 text-[11px] uppercase tracking-[0.25em] text-emerald-700"
          >
            Credentials
          </p>
          <h2
            data-about-lines
            className="mb-10 text-2xl font-light text-gray-900 sm:mb-14 sm:text-3xl"
          >
            Licences &amp; Accreditations
          </h2>

          <div data-about-card-group className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                name: "Myanmar Gems Enterprise (MGE)",
                detail: "Licensed trader & exporter under the Myanmar Gemstone Law (2019). Licence No. MGE-2003-0471. Annual renewal in good standing since 2003.",
              },
              {
                name: "ISO 9001:2015",
                detail: "Quality management certification covering gemstone grading, documentation, and customer service processes. First awarded 2011; most recently renewed 2023.",
              },
              {
                name: "GIA Alignment Protocol",
                detail: "Grading nomenclature and disclosure standards align with GIA's Jadeite Grading Report framework. Adopted company-wide in 2016; reviewed annually.",
              },
              {
                name: "Blockchain Provenance Ledger",
                detail: "Pieces valued above THB 10,000 are recorded on an immutable distributed ledger. Certificate QR codes link directly to on-chain provenance records. Launched 2022.",
              },
              {
                name: "Hpakant Responsible Sourcing Accord",
                detail: "Member since 2014, committing to environmental remediation payments, worker welfare standards, and independent audit access at our partner mines.",
              },
              {
                name: "Christie's & Bonhams Approved",
                detail: "Approved consignment supplier for Christie's Hong Kong and Bonhams London Jewels & Jade auctions since 2018. Over 40 lots placed to date.",
              },
            ].map((c, i) => (
              <div
                key={i}
                data-about-card
                className="rounded-xl border border-gray-100 p-5 transition-shadow hover:shadow-md sm:p-6"
              >
                <div data-about-divider className="mb-4 h-px w-5 origin-left bg-emerald-600" />
                <h3 className="mb-2 text-sm font-medium text-gray-900">{c.name}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Location ─── */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
          <div
            data-about-scrub-section
            className="grid items-start gap-10 md:grid-cols-2 md:gap-16"
          >
            <div
              data-about-image
              className="relative min-h-[320px] w-full overflow-hidden bg-gray-100 sm:min-h-[420px]"
            >
              <Image
                src="/images/ab2.png"
                alt="JadePalace Location"
                fill
                sizes="(min-width: 1024px) 42vw, 100vw"
                data-about-parallax
                className="object-cover"
              />
            </div>

            <div>
              <p
                data-about-text-item
                data-about-lines
                className="mb-2 text-[11px] uppercase tracking-[0.25em] text-emerald-700"
              >
                Find Us
              </p>

              <h2
                data-about-text-item
                data-about-lines
                className="mb-8 text-2xl font-light text-gray-900 sm:mb-10 sm:text-3xl"
              >
                Rooted in Myanmar
              </h2>

              <div data-about-card-group className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                {[
                  {
                    city: "Yangon — Flagship",
                    detail: "No. 47, Inya Road\nGolden Valley, Kamaryut Township\nYangon 11041, Myanmar\n\nMon–Sat 9:00 am–6:00 pm\nSun by appointment only",
                    tag: "Retail & Viewing",
                  },
                  {
                    city: "Mandalay — Workshop",
                    detail: "78th Street, Jade Quarter\nChan Aye Tharzan Township\nMandalay 05051, Myanmar\n\nMon–Fri 8:00 am–5:00 pm\nSaturday 8:00 am–1:00 pm",
                    tag: "Sourcing & Carving",
                  },
                  {
                    city: "Hong Kong — Liaison",
                    detail: "Room 1402, 14/F, King Wah Centre\n191–195 Des Voeux Rd Central\nHong Kong SAR\n\nBy appointment only",
                    tag: "Wholesale & Export",
                  },
                  {
                    city: "Contact",
                    detail: "info@jadepalacept.com\nsales@jadepalacept.com\n\n+95 (1) 500-1148 (Yangon)\n+95 (2) 402-3377 (Mandalay)\n+852 2111-4892 (Hong Kong)",
                    tag: "Enquiries",
                  },
                ].map((l, i) => (
                  <div key={i} data-about-card>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">
                      {l.tag}
                    </p>
                    <h4 className="mb-2 text-sm font-medium text-gray-900">{l.city}</h4>
                    <p className="whitespace-pre-line text-xs leading-relaxed text-gray-500">
                      {l.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer
        data-about-footer
        className="flex flex-col items-center justify-between gap-2 border-t border-gray-100 px-6 py-8 sm:flex-row sm:px-12 lg:px-20"
      >
        <span className="text-[11px] uppercase tracking-widest text-gray-400">
          Jade Palace Pt Co Ltd · MGE Licence No. MGE-2003-0471
        </span>

        <span className="text-[11px] text-gray-300">
          © {new Date().getFullYear()} · Mandalay, Myanmar
        </span>
      </footer>
    </div>
  );
}
