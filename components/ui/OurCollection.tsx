import Link from "next/link";
import React from "react";

const OurCollection = () => {
  const collections = [
    { name: "Necklaces", image: "/images/necklace.png" },
    { name: "Rings", image: "/images/ring.png" },
    { name: "Earrings", image: "/images/earring.png" },
    { name: "Bracelets", image: "/images/bracelet.png" },
  ];

  return (
    <section className="mx-auto px-6 sm:px-12 lg:px-20 py-16 bg-white">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-700 font-semibold mb-2">
          Handcrafted with Love
        </p>
        <h2 className="text-4xl sm:text-5xl font-light text-gray-900 tracking-tight">
          Our Collection
        </h2>
        <div className="mt-4 mx-auto w-16 h-px bg-emerald-700" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {collections.map((item, index) => (
          <Link href={`/${item.name}`}
            key={index}
            className="group relative overflow-hidden rounded-lg bg-stone-50 cursor-pointer"
          >
            {/* Image Container */}
            <div className="aspect-3/4 overflow-hidden">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-110"
              />
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Label */}
            <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
              <h3 className="text-white text-lg font-medium tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                {item.name}
              </h3>
              <span className="inline-block mt-1 text-emerald-300 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-150">
                Shop Now →
              </span>
            </div>

            {/* Static name badge (visible by default) */}
            <div className="absolute bottom-4 left-4 group-hover:opacity-0 transition-opacity duration-300">
              <span className="bg-white/80 backdrop-blur-sm text-gray-800 text-sm font-medium px-3 py-1 rounded-full shadow-sm">
                {item.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default OurCollection;