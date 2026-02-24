export default function AboutUs() {
  const values = [
    {
      title: "Authenticity",
      desc: "Every piece is certified and traceable to its source in Hpakant, Kachin State.",
    },
    {
      title: "Craftsmanship",
      desc: "Our artisans preserve centuries-old Burmese jade-working traditions.",
    },
    {
      title: "Integrity",
      desc: "Transparent pricing and honest grading define how we operate.",
    },
    {
      title: "Heritage",
      desc: "Proud stewards of Myanmar's most treasured natural gemstone.",
    },
  ];

  return (
    <div
      className="min-h-screen bg-white text-gray-800"
      style={{ fontFamily: "Georgia, serif" }}
    >
      {/* ================= Hero ================= */}
      <section className="px-6 sm:px-12 lg:px-20 py-24 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-green-700 mb-5">
          Est. 1998 · Mandalay, Myanmar
        </p>

        <h1 className="text-5xl font-light text-gray-900 mb-6 leading-tight">
          About Us
        </h1>

        <div className="w-10 h-px bg-green-600 mx-auto mb-8" />

        <p className="text-gray-500 leading-relaxed text-lg max-w-3xl mx-auto">
          JadePalace Pt Co Ltd is Myanmar&apos;s trusted name in the sourcing,
          certification, and global trade of fine jadeite jade — from the mines
          of Hpakant to collectors around the world.
        </p>
      </section>

      {/* ================= Story ================= */}
      <section className="border-t border-gray-100">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <div className="grid md:grid-cols-2 gap-16 items-center mb-16">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-green-700 mb-4">
                Our Story
              </p>

              <h2 className="text-3xl font-light text-gray-900 mb-6">
                A Quarter Century of Excellence
              </h2>

              <p className="text-gray-500 leading-relaxed mb-4">
                Founded in 1998 by U Kelvin in Mandalay, JadePalace began
                as a small workshop with a bold vision — to bring Myanmar&apos;s
                finest jadeite to the world with honesty and care.
              </p>

              <p className="text-gray-500 leading-relaxed">
                Over 26 years, we have grown into an internationally recognized
                house, trusted by jewelers, collectors, and connoisseurs from
                Hong Kong to New York.
              </p>
            </div>

            {/* Story Image */}
            <div className="w-full h-72 bg-gray-100 overflow-hidden">
              <img
                src="/images/ab1.png"
                alt="Our Story at JadePalace"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { num: "26+", label: "Years in Business" },
              { num: "5,000+", label: "Pieces Certified" },
              { num: "18", label: "Countries Served" },
              { num: "3rd Gen", label: "Master Artisans" },
            ].map((s, i) => (
              <div key={i} className="border border-gray-100 p-6">
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

      {/* ================= Values ================= */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <p className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2">
            Our Principles
          </p>

          <h2 className="text-3xl font-light text-gray-900 mb-12">
            What We Stand For
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((v, i) => (
              <div key={i}>
                <div className="w-6 h-px bg-green-600 mb-5" />
                <h3 className="text-base text-gray-900 mb-3">
                  {v.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Location ================= */}
      <section className="border-t border-gray-100">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Location Image */}
            <div className="w-full h-80 bg-gray-100 overflow-hidden">
              <img
                src="/images/ab2.png"
                alt="JadePalace Location"
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2">
                Find Us
              </p>

              <h2 className="text-3xl font-light text-gray-900 mb-10">
                Rooted in Myanmar
              </h2>

              <div className="grid sm:grid-cols-3 gap-8">
                {[
                  {
                    city: "Yangon",
                    detail:
                      "No. 47, Inya Road\nGolden Valley\nKamaryut Township",
                    tag: "Flagship",
                  },
                  {
                    city: "Mandalay",
                    detail:
                      "Jade Quarter\n78th Street\nChan Aye Tharzan",
                    tag: "Sourcing",
                  },
                  {
                    city: "Contact",
                    detail:
                      "info@jadepalacept.com\n+95 (1) 500-xxxx\nMon–Sat, 9am–6pm",
                    tag: "Enquiries",
                  },
                ].map((l, i) => (
                  <div key={i}>
                    <p className="text-xs tracking-wider uppercase text-gray-400 mb-2">
                      {l.tag}
                    </p>
                    <h4 className="text-sm text-gray-900 mb-2">
                      {l.city}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
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
      <footer className="border-t border-gray-100 px-6 sm:px-12 lg:px-20 py-8 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs tracking-widest text-gray-400 uppercase">
          Jade Palace Pt Co Ltd
        </span>

        <span className="text-xs text-gray-300">
          © {new Date().getFullYear()} · Mandalay, Myanmar
        </span>
      </footer>
    </div>
  );
}
