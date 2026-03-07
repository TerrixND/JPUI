"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

const ScrollHero = () => {
  const bgRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!bgRef.current || window.innerWidth < 768) return;
      bgRef.current.style.transform = `scale(1.08) translateY(${window.scrollY * 0.15}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Jost:wght@200;300;400&display=swap');

        /* ── ALL selectors scoped under .sh__ prefix — zero global bleed ── */

        .sh__wrap {
          position: relative;
          width: 100%;
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #faf8f4;
          box-sizing: border-box;
        }

        .sh__bg {
          position: absolute;
          inset: -8%;
          background-image: url('/images/whiteBg.jpg');
          background-size: cover;
          background-position: center;
          transform: scale(1.08);
          transform-origin: center;
          transition: transform 0.1s linear;
          filter: brightness(0.96) saturate(0.85) sepia(0.04);
          will-change: transform;
        }

        .sh__overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(
              to top,
              rgba(26, 74, 58, 0.18) 0%,
              rgba(26, 74, 58, 0.06) 40%,
              rgba(250, 248, 244, 0.0) 70%
            ),
            radial-gradient(
              ellipse 80% 70% at 50% 50%,
              transparent 30%,
              rgba(15, 31, 24, 0.12) 100%
            );
        }

        .sh__grain {
          position: absolute;
          inset: 0;
          z-index: 2;
          opacity: 0.035;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px 180px;
        }

        .sh__line-left,
        .sh__line-right {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 5;
          width: 1px;
          height: 0;
          background: linear-gradient(to bottom, transparent, #2d6e56, transparent);
          transition: height 1.2s cubic-bezier(0.16,1,0.3,1) 0.9s,
                      opacity 0.4s ease 0.9s;
          opacity: 0;
        }
        .sh__line-left  { left:  clamp(2rem, 6vw, 5rem); }
        .sh__line-right { right: clamp(2rem, 6vw, 5rem); }

        .sh__line-left::before,
        .sh__line-left::after,
        .sh__line-right::before,
        .sh__line-right::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 5px;
          height: 1px;
          background: #2d6e56;
        }
        .sh__line-left::before,  .sh__line-right::before { top: 0; }
        .sh__line-left::after,   .sh__line-right::after  { bottom: 0; }

        .sh__wrap.is-loaded .sh__line-left,
        .sh__wrap.is-loaded .sh__line-right {
          height: clamp(80px, 20vh, 160px);
          opacity: 1;
        }

        .sh__content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 0 clamp(1.5rem, 6vw, 4rem);
          max-width: 720px;
          width: 100%;
          box-sizing: border-box;
        }

        .sh__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.7em;
          font-family: 'Jost', sans-serif;
          font-weight: 300;
          font-size: clamp(0.56rem, 1.5vw, 0.62rem);
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: #1a4a3a;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.8s ease 0.15s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s;
          margin-bottom: clamp(1.4rem, 3.5vw, 2rem);
          /* reset any inherited styles */
          font-style: normal;
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
          line-height: 1;
        }
        .sh__eyebrow::before,
        .sh__eyebrow::after {
          content: '';
          display: block;
          width: clamp(20px, 4vw, 32px);
          height: 1px;
          background: #4a9e7e;
          opacity: 0.6;
          flex-shrink: 0;
        }

        .sh__title {
          font-family: 'Cormorant', Georgia, serif;
          font-weight: 300;
          font-size: clamp(3.4rem, 12vw, 7.5rem);
          line-height: 0.95;
          color: #0f1f18;
          letter-spacing: -0.02em;
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 1.1s ease 0.4s, transform 1.1s cubic-bezier(0.16,1,0.3,1) 0.4s;
          margin-bottom: clamp(0.6rem, 2vw, 1rem);
          /* resets */
          font-style: normal;
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
        }
        .sh__title em {
          font-style: italic;
          font-weight: 400;
          color: #1a4a3a;
          display: block;
        }

        .sh__ornament {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          opacity: 0;
          transform: scaleX(0.6);
          transition: opacity 0.9s ease 0.75s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.75s;
          margin: clamp(1.2rem, 3vw, 1.8rem) 0;
        }
        .sh__ornament-line {
          width: clamp(30px, 8vw, 50px);
          height: 1px;
          background: #4a9e7e;
          opacity: 0.5;
        }
        .sh__ornament-diamond {
          width: 5px;
          height: 5px;
          border: 1px solid #1a4a3a;
          transform: rotate(45deg);
          opacity: 0.7;
          flex-shrink: 0;
        }

        .sh__subtitle {
          font-family: 'Jost', sans-serif;
          font-weight: 200;
          font-size: clamp(0.72rem, 2vw, 0.85rem);
          letter-spacing: 0.16em;
          color: rgba(15, 31, 24, 0.85);
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.9s ease 0.95s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.95s;
          margin-bottom: clamp(2.2rem, 5vw, 3.2rem);
          /* resets */
          font-style: normal;
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
          line-height: 1.5;
        }

        .sh__cta-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
          gap: clamp(0.8rem, 3vw, 1.4rem);
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.9s ease 1.1s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 1.1s;
        }

        .sh__btn-primary {
          font-family: 'Jost', sans-serif;
          font-weight: 300;
          font-size: clamp(0.58rem, 1.6vw, 0.65rem);
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: #faf8f4;
          background: #1a4a3a;
          border: none;
          padding: clamp(0.8rem, 2vw, 1rem) clamp(1.8rem, 5vw, 2.8rem);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: color 0.4s ease;
          line-height: 1;
          text-decoration: none;
          display: inline-block;
          box-sizing: border-box;
        }
        .sh__btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: #2d6e56;
          transform: translateX(-101%);
          transition: transform 0.45s cubic-bezier(0.16,1,0.3,1);
        }
        .sh__btn-primary:hover::before { transform: translateX(0); }
        .sh__btn-primary span { position: relative; z-index: 1; }

        .sh__btn-ghost {
          font-family: 'Jost', sans-serif;
          font-weight: 300;
          font-size: clamp(0.58rem, 1.6vw, 0.65rem);
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: #1a4a3a;
          background: none;
          border: 1px solid rgba(26, 74, 58, 0.35);
          padding: clamp(0.8rem, 2vw, 1rem) clamp(1.8rem, 5vw, 2.8rem);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: color 0.4s ease, border-color 0.4s ease;
          line-height: 1;
          text-decoration: none;
          display: inline-block;
          box-sizing: border-box;
        }
        .sh__btn-ghost::before {
          content: '';
          position: absolute;
          inset: 0;
          background: #1a4a3a;
          transform: translateX(-101%);
          transition: transform 0.45s cubic-bezier(0.16,1,0.3,1);
        }
        .sh__btn-ghost:hover { color: #faf8f4; border-color: #1a4a3a; }
        .sh__btn-ghost:hover::before { transform: translateX(0); }
        .sh__btn-ghost span { position: relative; z-index: 1; }

        /* ── Loaded state triggers ── */
        .sh__wrap.is-loaded .sh__eyebrow,
        .sh__wrap.is-loaded .sh__title,
        .sh__wrap.is-loaded .sh__subtitle,
        .sh__wrap.is-loaded .sh__cta-row {
          opacity: 1;
          transform: translateY(0);
        }
        .sh__wrap.is-loaded .sh__ornament {
          opacity: 1;
          transform: scaleX(1);
        }

        /* ── Scroll indicator ── */
        .sh__scroll-hint {
          position: absolute;
          bottom: clamp(1.5rem, 4vw, 2.2rem);
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.45rem;
          opacity: 0;
          transition: opacity 0.8s ease 1.7s;
        }
        .sh__wrap.is-loaded .sh__scroll-hint { opacity: 1; }
        .sh__scroll-hint span {
          font-family: 'Jost', sans-serif;
          font-size: 0.5rem;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: rgba(26, 74, 58, 0.45);
          font-weight: 300;
          font-style: normal;
        }
        .sh__scroll-line {
          width: 1px;
          height: 28px;
          background: linear-gradient(to bottom, #4a9e7e, transparent);
          animation: sh__scrollPulse 2.2s ease-in-out infinite;
        }
        @keyframes sh__scrollPulse {
          0%, 100% { opacity: 0.35; transform: scaleY(1);    }
          50%       { opacity: 1;    transform: scaleY(1.12); }
        }
      `}</style>

      <div className={`sh__wrap${loaded ? " is-loaded" : ""}`}>
        <div className="sh__bg" ref={bgRef} />
        <div className="sh__overlay" />
        <div className="sh__grain" />

        <div className="sh__line-left" />
        <div className="sh__line-right" />

        <div className="sh__content">
          <p className="sh__eyebrow">Heritage Collection</p>

          <h1 className="sh__title">
            Timeless
            <em>Craftsmanship</em>
          </h1>

          <div className="sh__ornament">
            <div className="sh__ornament-line" />
            <div className="sh__ornament-diamond" />
            <div className="sh__ornament-line" />
          </div>

          <p className="sh__subtitle">Where tradition meets modern elegance</p>

          <div className="sh__cta-row">
            <Link href={"/products"} className="sh__btn-primary">
              <span>Explore Collection</span>
            </Link>
            <Link href={"aboutus"} className="sh__btn-ghost">
              <span>Our Story</span>
            </Link>
          </div>
        </div>

        <div className="sh__scroll-hint">
          <span>Scroll</span>
          <div className="sh__scroll-line" />
        </div>
      </div>
    </>
  );
};

export default ScrollHero;