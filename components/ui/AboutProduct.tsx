import { ChevronRight } from "@boxicons/react";
import Link from "next/link";
import React from "react";

const AboutProduct = () => {
  const stats = [
    { value: "40+", label: "Years of craft" },
    { value: "12K+", label: "Pieces sold" },
    { value: "98%", label: "Client satisfaction" },
  ];
  return (
    <section className="w-full bg-neutral-100 py-20 overflow-hidden">
      {/* Same horizontal padding as Navbar */}
      <div className="px-6 sm:px-12 lg:px-20 relative">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Image Wrapper */}
          <div className="relative h-72 md:h-96 overflow-hidden group">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent z-10 pointer-events-none" />

            {/* Hover shimmer */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-linear-to-br from-white/10 via-transparent to-transparent z-20 pointer-events-none" />

            {/* Image */}
            <img
              src="/images/jadeBg.png"
              alt="Jade Necklace"
              className="absolute inset-0 w-full h-full object-full scale-100 transition-transform duration-700 ease-out"
            />

            {/* Caption */}
            <div className="absolute bottom-0 left-0 right-0 z-30 px-5 py-4 translate-y-2 group-hover:translate-y-0 opacity-80 group-hover:opacity-100 transition-all duration-500">
              <p className="text-white text-xs tracking-[0.25em] uppercase font-light">
                Rare. Refined. Remarkable.
              </p>
            </div>
          </div>

          {/* ===== Right: Content ===== */}
          <div className="flex flex-col justify-between h-full gap-10 lg:pl-10">
            {/* Text block */}
            <div className="space-y-5">
              <span className="text-xs tracking-[0.3em] text-neutral-400 uppercase">
                About Product
              </span>

              <h3 className="text-2xl lg:text-3xl font-light tracking-tight text-neutral-900 leading-snug">
                Rare. Refined. Remarkable.
              </h3>

              <p className="text-sm text-neutral-500 leading-relaxed max-w-md">
                For more than 40 years, we have dedicated ourselves to the art
                of jade craftsmanship. Each piece is carefully shaped with
                precision and patience by our skilled artisans. We select rare
                stones and transform them into elegant designs that reflect
                timeless beauty. Every creation is made to be treasured today
                and passed down for generations.
              </p>

              <Link
                href="#"
                className="inline-flex items-center gap-2 border border-neutral-300 px-6 py-2.5 text-sm tracking-widest uppercase text-neutral-500 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition duration-300"
              >
                See More →
              </Link>
            </div>

            {/* ===== Stats row ===== */}
            <div className="grid grid-cols-3 divide-x divide-neutral-200 border-t border-neutral-200 pt-8">
              {stats.map((stat) => (
                <div key={stat.label} className="px-4 first:pl-0">
                  <p className="text-2xl font-light text-neutral-900">
                    {stat.value}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 tracking-wide">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutProduct;
