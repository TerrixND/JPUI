// import Link from "next/link";
// import React from "react";

// const OurCollection = () => {
//   const collections = [
//     { name: "Necklaces", image: "/images/necklace.png" },
//     { name: "Rings", image: "/images/ring.png" },
//     { name: "Earrings", image: "/images/earring.png" },
//     { name: "Bracelets", image: "/images/bracelet.png" },
//   ];

//   return (
//     <section className="mx-auto px-6 sm:px-12 lg:px-20 py-16 bg-white">
//       {/* Header */}
//       <div className="text-center mb-12">
//         <p className="text-xs uppercase tracking-[0.3em] text-emerald-700 font-semibold mb-2">
//           Handcrafted with Love
//         </p>
//         <h2 className="text-4xl sm:text-5xl font-light text-gray-900 tracking-tight">
//           Our Collection
//         </h2>
//         <div className="mt-4 mx-auto w-16 h-px bg-emerald-700" />
//       </div>

//       {/* Grid */}
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
//         {collections.map((item, index) => (
//           <Link href={`/${item.name}`}
//             key={index}
//             className="group relative overflow-hidden rounded-lg bg-stone-50 cursor-pointer"
//           >
//             {/* Image Container */}
//             <div className="aspect-3/4 overflow-hidden">
//               <img
//                 src={item.image}
//                 alt={item.name}
//                 className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-110"
//               />
//             </div>

//             {/* Overlay */}
//             <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

//             {/* Label */}
//             <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
//               <h3 className="text-white text-lg font-medium tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
//                 {item.name}
//               </h3>
//               <span className="inline-block mt-1 text-emerald-300 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-150">
//                 Shop Now →
//               </span>
//             </div>

//             {/* Static name badge (visible by default) */}
//             <div className="absolute bottom-4 left-4 group-hover:opacity-0 transition-opacity duration-300">
//               <span className="bg-white/80 backdrop-blur-sm text-gray-800 text-sm font-medium px-3 py-1 rounded-full shadow-sm">
//                 {item.name}
//               </span>
//             </div>
//           </Link>
//         ))}
//       </div>
//     </section>
//   );
// };

// export default OurCollection;





// import { ChevronRight } from "@boxicons/react";
// import React from "react";

// const AboutProduct = () => {
//   return (
//     <section className="w-full bg-neutral-50 py-16 overflow-hidden">
//       {/* Same horizontal padding as Navbar */}
//       <div className="px-6 sm:px-12 lg:px-20 relative">
//         <div className="grid md:grid-cols-2 gap-12 items-center">
//           {/* Image Wrapper */}
//           <div className="relative h-72 md:h-96 overflow-hidden group">
//             {/* Gradient overlay */}
//             <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent z-10 pointer-events-none" />

//             {/* Hover shimmer */}
//             <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-linear-to-br from-white/10 via-transparent to-transparent z-20 pointer-events-none" />

//             {/* Image */}
//             <img
//               src="/images/jadeBg.png"
//               alt="Jade Necklace"
//               className="absolute inset-0 w-full h-full object-full scale-100 transition-transform duration-700 ease-out"
//             />

//             {/* Caption */}
//             <div className="absolute bottom-0 left-0 right-0 z-30 px-5 py-4 translate-y-2 group-hover:translate-y-0 opacity-80 group-hover:opacity-100 transition-all duration-500">
//               <p className="text-white text-xs tracking-[0.25em] uppercase font-light">
//                 Jade Collection
//               </p>
//             </div>
//           </div>

//           {/* Content */}
//           <div className="space-y-5 z-10">
//             <span className="text-xs tracking-[0.3em] text-emerald-700 uppercase">
//               About Product
//             </span>

//             <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-snug">
//               Rare. Refined. Remarkable.
//             </h2>

//             <p className="text-gray-600 leading-relaxed text-base max-w-lg">
//               With over four decades of dedication, every jade piece is shaped
//               with precision and care. Our expert artisans transform rare stones
//               into timeless works of elegance — crafted to be treasured for
//               generations.
//             </p>

//             <button className="group inline-flex items-center gap-2 mt-3 px-6 py-2.5 border border-gray-900 text-gray-900 text-sm tracking-wide transition-all duration-300 hover:bg-gray-900 hover:text-white cursor-pointer">
//               <span>See More</span>
//               <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
//             </button>
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// };

// export default AboutProduct;





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
    <section className="w-full bg-neutral-100 py-16 overflow-hidden">
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
                Jade Collection
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
                Rare. Refined. <br /> Remarkable.
              </h3>

              <p className="text-sm text-neutral-500 leading-relaxed max-w-md">
                With over four decades of dedication, every jade piece is shaped
                with precision and care. Our expert artisans transform rare
                stones into timeless works of elegance — crafted to be treasured
                for generations.
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
