"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";

type SplitLineResult = {
  lines: HTMLSpanElement[];
  revert: () => void;
};

function splitElementLines(element: HTMLElement): SplitLineResult | null {
  const originalHtml = element.innerHTML;
  const text = element.textContent?.replace(/\s+/g, " ").trim();

  if (!text) {
    return null;
  }

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

    if (!lineGroups.length) {
      lineGroups.push([]);
    }

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
    line.style.willChange = "transform, opacity, filter";

    group.forEach((wordSpan) => {
      line.appendChild(wordSpan);
    });

    mask.appendChild(line);
    element.appendChild(mask);
    lines.push(line);
  });

  return {
    lines,
    revert: () => {
      element.innerHTML = originalHtml;
    },
  };
}

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
    {
      year: "1998",
      event:
        "Founded by U Kelvin Aung in Mandalay's jade quarter with 3 staff and a single workshop bench on 78th Street.",
    },
    {
      year: "2003",
      event:
        "Secured first direct mining partnership with a Hpakant cooperative, ensuring traceable rough supply from mine to finished piece.",
    },
    {
      year: "2007",
      event:
        "Opened Yangon flagship on Inya Road, Golden Valley. Expanded into retail alongside long-standing wholesale operations.",
    },
    {
      year: "2011",
      event:
        "Achieved ISO 9001 certification for gemstone grading processes — the first jade company in Myanmar to do so.",
    },
    {
      year: "2014",
      event:
        "Launched proprietary triple-blind grading protocol. Certified our 1,000th piece. Signed the Hpakant Responsible Sourcing Accord.",
    },
    {
      year: "2018",
      event:
        "Established Hong Kong liaison office. Became an approved consignment supplier for Christie's and Bonhams Jewels & Jade auctions.",
    },
    {
      year: "2022",
      event:
        "Introduced a blockchain-based provenance ledger for all pieces valued above THB 10,000. Certificate QR codes link to on-chain records.",
    },
    {
      year: "2024",
      event:
        "26 years in business. 5,000+ certified pieces across 18 countries. Three generations of master artisans in our Mandalay workshop.",
    },
  ];

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const splitResults = new Map<HTMLElement, SplitLineResult>();

    const ctx = gsap.context(() => {
      const animateSplitLines = (
        timeline: gsap.core.Timeline,
        element: HTMLElement,
        position: number,
        seed: number,
      ) => {
        const split = splitResults.get(element);

        if (!split?.lines.length) {
          timeline.fromTo(
            element,
            {
              autoAlpha: 0,
              x: seed % 2 === 0 ? -58 : 58,
              y: 28,
              filter: "blur(10px)",
            },
            {
              autoAlpha: 1,
              x: 0,
              y: 0,
              filter: "blur(0px)",
              duration: 0.9,
              ease: "power3.out",
              clearProps: "transform,opacity,filter",
            },
            position,
          );

          return;
        }

        timeline.fromTo(
          split.lines,
          {
            autoAlpha: 0,
            x: (index) => ((index + seed) % 2 === 0 ? -74 : 74),
            y: (index) => 24 + (index % 3) * 8,
            rotate: (index) => ((index + seed) % 2 === 0 ? -1.8 : 1.8),
            filter: "blur(12px)",
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            rotate: 0,
            filter: "blur(0px)",
            duration: 0.92,
            stagger: 0.09,
            ease: "power3.out",
            clearProps: "transform,opacity,filter",
          },
          position,
        );
      };

      gsap.utils
        .toArray<HTMLElement>("[data-about-lines]")
        .forEach((element) => {
          const split = splitElementLines(element);

          if (split) {
            splitResults.set(element, split);
          }
        });

      const heroItems = gsap.utils.toArray<HTMLElement>("[data-about-hero-item]");
      if (heroItems.length) {
        const heroTimeline = gsap.timeline();
        let heroPosition = 0;

        heroItems.forEach((item, index) => {
          if (item.hasAttribute("data-about-hero-divider")) {
            heroTimeline.fromTo(
              item,
              {
                autoAlpha: 0,
                scaleX: 0,
                transformOrigin: "center center",
              },
              {
                autoAlpha: 1,
                scaleX: 1,
                duration: 0.7,
                ease: "power2.out",
                clearProps: "transform,opacity",
              },
              heroPosition,
            );

            heroPosition += 0.12;
            return;
          }

          animateSplitLines(heroTimeline, item, heroPosition, index);
          heroPosition += Math.max(0.2, (splitResults.get(item)?.lines.length ?? 1) * 0.14);
        });
      }

      const scrubSections = gsap.utils.toArray<HTMLElement>("[data-about-scrub-section]");
      scrubSections.forEach((section, sectionIndex) => {
        const textItems = Array.from(
          section.querySelectorAll<HTMLElement>("[data-about-text-item]"),
        );
        const imageContainer = section.querySelector<HTMLElement>("[data-about-image]");
        const parallaxImage = section.querySelector<HTMLElement>("[data-about-parallax]");

        if (textItems.length || imageContainer) {
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top 84%",
              end: "top 24%",
              scrub: 1.1,
            },
          });

          if (textItems.length) {
            textItems.forEach((textItem, itemIndex) => {
              animateSplitLines(
                timeline,
                textItem,
                itemIndex * 0.14,
                sectionIndex + itemIndex,
              );
            });
          }

          if (imageContainer) {
            timeline.fromTo(
              imageContainer,
              {
                autoAlpha: 0,
                x: 92,
                y: 54,
                rotate: 1.8,
                scale: 1.1,
                filter: "blur(16px)",
              },
              {
                autoAlpha: 1,
                x: 0,
                y: 0,
                rotate: 0,
                scale: 1,
                filter: "blur(0px)",
                duration: 1.2,
                ease: "power3.out",
              },
              0.08,
            );
          }
        }

        if (parallaxImage) {
          gsap.fromTo(
            parallaxImage,
            {
              scale: 1.16,
              yPercent: 8,
            },
            {
              scale: 1.02,
              yPercent: -4,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top bottom",
                end: "bottom top",
                scrub: 1.2,
              },
            },
          );
        }
      });

      const standaloneLineElements = Array.from(splitResults.keys()).filter(
        (element) =>
          !element.closest("[data-about-hero]") &&
          !element.closest("[data-about-scrub-section]"),
      );

      standaloneLineElements.forEach((element, index) => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        });

        animateSplitLines(timeline, element, 0, index);
      });

      const cards = gsap.utils.toArray<HTMLElement>("[data-about-card]");
      cards.forEach((card, index) => {
        gsap.fromTo(
          card,
          {
            autoAlpha: 0,
            x: index % 2 === 0 ? -18 : 18,
            y: 54,
            scale: 0.965,
            filter: "blur(10px)",
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.95,
            ease: "power3.out",
            clearProps: "transform,opacity,filter",
            scrollTrigger: {
              trigger: card,
              start: "top 86%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      const footer = root.querySelector<HTMLElement>("[data-about-footer]");
      if (footer) {
        gsap.fromTo(
          footer.children,
          {
            autoAlpha: 0,
            y: 30,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.08,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: footer,
              start: "top 92%",
              toggleActions: "play none none none",
            },
          },
        );
      }
    }, root);

    return () => {
      ctx.revert();
      splitResults.forEach((split) => {
        split.revert();
      });
    };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-gray-800">
      {/* ================= Hero ================= */}
      <section data-about-hero className="px-6 sm:px-12 lg:px-20 py-24 text-center">
        <p
          data-about-hero-item
          data-about-lines
          className="text-xs tracking-[0.3em] uppercase text-green-700 mb-5"
        >
          Est. 1998 · Mandalay, Myanmar · MGE Licence No. MGE-2003-0471
        </p>

        <h1
          data-about-hero-item
          data-about-lines
          className="text-5xl font-light text-gray-900 mb-6 leading-tight"
        >
          About Us
        </h1>

        <div
          data-about-hero-item
          data-about-hero-divider
          className="w-10 h-px bg-green-600 mx-auto mb-8"
        />

        <p
          data-about-hero-item
          data-about-lines
          className="text-gray-500 leading-relaxed text-lg max-w-3xl mx-auto"
        >
          JadePalace Pt Co Ltd is Myanmar&apos;s trusted name in the sourcing,
          certification, and global trade of fine jadeite jade — from the mines
          of Hpakant to collectors around the world. Licensed under
          Myanmar&apos;s Gemstone Law (2019) and registered with the Myanmar
          Gems Enterprise.
        </p>
      </section>

      {/* ================= Story ================= */}
      <section className="border-t border-gray-100">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <div
            data-about-scrub-section
            className="grid md:grid-cols-2 gap-16 items-center mb-16"
          >
            <div>
              <p
                data-about-text-item
                data-about-lines
                className="text-xs tracking-[0.25em] uppercase text-green-700 mb-4"
              >
                Our Story
              </p>

              <h2
                data-about-text-item
                data-about-lines
                className="text-3xl font-light text-gray-900 mb-6"
              >
                A Quarter Century of Excellence
              </h2>

              <p
                data-about-text-item
                data-about-lines
                className="text-gray-500 leading-relaxed mb-4"
              >
                Founded in 1998 by U Kelvin Aung in Mandalay, JadePalace began
                as a three-person workshop on 78th Street with a bold vision —
                to bring Myanmar&apos;s finest jadeite to the world with
                complete honesty and meticulous documentation at every step.
              </p>

              <p
                data-about-text-item
                data-about-lines
                className="text-gray-500 leading-relaxed mb-4"
              >
                In 2003 we formed our first direct mining partnership with a
                Hpakant cooperative in Kachin State, giving us unbroken
                chain-of-custody from rough stone to finished piece — a standard
                rare in the industry at that time.
              </p>

              <p
                data-about-text-item
                data-about-lines
                className="text-gray-500 leading-relaxed"
              >
                Over 26 years we have grown into an internationally recognised
                house, trusted by jewellers, collectors, and auction houses from
                Hong Kong to New York. In 2011 we became the first Myanmar jade
                company to achieve ISO 9001 certification for gemstone grading
                processes.
              </p>
            </div>

            {/* Story Image */}
            <div
              data-about-image
              className="relative min-h-[360px] w-full h-full bg-gray-100 overflow-hidden"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { num: "26+", label: "Years in Business" },
              { num: "5,000+", label: "Pieces Certified" },
              { num: "18", label: "Countries Served" },
              { num: "80+", label: "Wholesale Clients" },
            ].map((s, i) => (
              <div key={i} data-about-card className="border border-gray-100 p-6">
                <div className="text-3xl font-light text-green-700 mb-1">
                  {s.num}
                </div>
                <div className="text-xs tracking-wider uppercase text-gray-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Milestones ================= */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <p
            data-about-lines
            className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2"
          >
            Company History
          </p>
          <h2
            data-about-lines
            className="text-3xl font-light text-gray-900 mb-12"
          >
            Key Milestones
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-8">
            {milestones.map((m, i) => (
              <div key={i} data-about-card className="flex gap-6">
                <div className="text-sm font-light text-green-700 w-12 shrink-0 pt-0.5">
                  {m.year}
                </div>
                <div>
                  <div className="w-4 h-px bg-green-300 mb-3 mt-2" />
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {m.event}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Values ================= */}
      <section className="border-t border-gray-100">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <p
            data-about-lines
            className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2"
          >
            Our Principles
          </p>

          <h2
            data-about-lines
            className="text-3xl font-light text-gray-900 mb-12"
          >
            What We Stand For
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((v, i) => (
              <div key={i} data-about-card>
                <div className="w-6 h-px bg-green-600 mb-5" />
                <h3 className="text-base text-gray-900 mb-3">{v.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Team ================= */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <p
            data-about-lines
            className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2"
          >
            Leadership
          </p>
          <h2
            data-about-lines
            className="text-3xl font-light text-gray-900 mb-12"
          >
            The People Behind JadePalace
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((person, i) => (
              <div
                key={i}
                data-about-card
                className="bg-white border border-gray-100 p-6"
              >
                <p className="text-xs tracking-wider uppercase text-green-700 mb-1">
                  {person.since}
                </p>
                <h3 className="text-sm text-gray-900 mb-1">{person.name}</h3>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  {person.role}
                </p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {person.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Certifications ================= */}
      <section className="border-t border-gray-100">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <p
            data-about-lines
            className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2"
          >
            Credentials
          </p>
          <h2
            data-about-lines
            className="text-3xl font-light text-gray-900 mb-12"
          >
            Licences &amp; Accreditations
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "Myanmar Gems Enterprise (MGE)",
                detail:
                  "Licensed trader & exporter under the Myanmar Gemstone Law (2019). Licence No. MGE-2003-0471. Annual renewal in good standing since 2003.",
              },
              {
                name: "ISO 9001:2015",
                detail:
                  "Quality management certification covering gemstone grading, documentation, and customer service processes. First awarded 2011; most recently renewed 2023.",
              },
              {
                name: "GIA Alignment Protocol",
                detail:
                  "Grading nomenclature and disclosure standards align with GIA's Jadeite Grading Report framework. Adopted company-wide in 2016; reviewed annually.",
              },
              {
                name: "Blockchain Provenance Ledger",
                detail:
                  "Pieces valued above THB 10,000 are recorded on an immutable distributed ledger. Certificate QR codes link directly to on-chain provenance records. Launched 2022.",
              },
              {
                name: "Hpakant Responsible Sourcing Accord",
                detail:
                  "Member since 2014, committing to environmental remediation payments, worker welfare standards, and independent audit access at our partner mines.",
              },
              {
                name: "Christie's & Bonhams Approved",
                detail:
                  "Approved consignment supplier for Christie's Hong Kong and Bonhams London Jewels & Jade auctions since 2018. Over 40 lots placed to date.",
              },
            ].map((c, i) => (
              <div key={i} data-about-card className="border border-gray-100 p-6">
                <div className="w-4 h-px bg-green-600 mb-4" />
                <h3 className="text-sm text-gray-900 mb-2">{c.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {c.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Location ================= */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <div
            data-about-scrub-section
            className="grid md:grid-cols-2 gap-16 items-start"
          >
            {/* Location Image */}
            <div
              data-about-image
              className="relative min-h-[420px] w-full h-full bg-gray-100 overflow-hidden"
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
                className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2"
              >
                Find Us
              </p>

              <h2
                data-about-text-item
                data-about-lines
                className="text-3xl font-light text-gray-900 mb-10"
              >
                Rooted in Myanmar
              </h2>

              <div className="grid sm:grid-cols-2 gap-8">
                {[
                  {
                    city: "Yangon — Flagship",
                    detail:
                      "No. 47, Inya Road\nGolden Valley, Kamaryut Township\nYangon 11041, Myanmar\n\nMon–Sat 9:00 am–6:00 pm\nSun by appointment only",
                    tag: "Retail & Viewing",
                  },
                  {
                    city: "Mandalay — Workshop",
                    detail:
                      "78th Street, Jade Quarter\nChan Aye Tharzan Township\nMandalay 05051, Myanmar\n\nMon–Fri 8:00 am–5:00 pm\nSaturday 8:00 am–1:00 pm",
                    tag: "Sourcing & Carving",
                  },
                  {
                    city: "Hong Kong — Liaison",
                    detail:
                      "Room 1402, 14/F, King Wah Centre\n191–195 Des Voeux Rd Central\nHong Kong SAR\n\nBy appointment only",
                    tag: "Wholesale & Export",
                  },
                  {
                    city: "Contact",
                    detail:
                      "info@jadepalacept.com\nsales@jadepalacept.com\n\n+95 (1) 500-1148 (Yangon)\n+95 (2) 402-3377 (Mandalay)\n+852 2111-4892 (Hong Kong)",
                    tag: "Enquiries",
                  },
                ].map((l, i) => (
                  <div key={i} data-about-text-item>
                    <p className="text-xs tracking-wider uppercase text-gray-500 mb-2">
                      {l.tag}
                    </p>
                    <h4 className="text-sm text-gray-900 mb-2">{l.city}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
                      {l.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer
        data-about-footer
        className="border-t border-gray-100 px-6 sm:px-12 lg:px-20 py-8 flex flex-col sm:flex-row items-center justify-between gap-2"
      >
        <span className="text-xs tracking-widest text-gray-400 uppercase">
          Jade Palace Pt Co Ltd · MGE Licence No. MGE-2003-0471
        </span>

        <span className="text-xs text-gray-300">
          © {new Date().getFullYear()} · Mandalay, Myanmar
        </span>
      </footer>
    </div>
  );
}

