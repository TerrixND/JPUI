import { ChevronRight } from "@boxicons/react";
import React from "react";

const AboutProduct = () => {
  return (
    <section className="w-full bg-gray-100 py-16 overflow-hidden">
      {/* Same horizontal padding as Navbar */}
      <div className="px-6 sm:px-12 lg:px-20 relative">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Image Wrapper */}
          <div className="relative h-72 md:h-96 overflow-hidden rounded-lg group">
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
                Jade Collection
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-5 z-10">
            <span className="text-xs tracking-[0.3em] text-emerald-700 uppercase">
              About Product
            </span>

            <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-snug">
              Rare. Refined. Remarkable.
            </h2>

            <p className="text-gray-600 leading-relaxed text-base max-w-lg">
              With over four decades of dedication, every jade piece is shaped
              with precision and care. Our expert artisans transform rare stones
              into timeless works of elegance — crafted to be treasured for
              generations.
            </p>

            <button className="group inline-flex items-center gap-2 mt-3 px-6 py-2.5 border border-gray-900 text-gray-900 text-sm tracking-wide transition-all duration-300 hover:bg-gray-900 hover:text-white cursor-pointer">
              <span>See More</span>
              <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutProduct;
