export default function AboutUs() {
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
        "Introduced a blockchain-based provenance ledger for all pieces valued above USD 10,000. Certificate QR codes link to on-chain records.",
    },
    {
      year: "2024",
      event:
        "26 years in business. 5,000+ certified pieces across 18 countries. Three generations of master artisans in our Mandalay workshop.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* ================= Hero ================= */}
      <section className="px-6 sm:px-12 lg:px-20 py-24 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-green-700 mb-5">
          Est. 1998 · Mandalay, Myanmar · MGE Licence No. MGE-2003-0471
        </p>

        <h1 className="text-5xl font-light text-gray-900 mb-6 leading-tight">
          About Us
        </h1>

        <div className="w-10 h-px bg-green-600 mx-auto mb-8" />

        <p className="text-gray-500 leading-relaxed text-lg max-w-3xl mx-auto">
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
          <div className="grid md:grid-cols-2 gap-16 items-center mb-16">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-green-700 mb-4">
                Our Story
              </p>

              <h2 className="text-3xl font-light text-gray-900 mb-6">
                A Quarter Century of Excellence
              </h2>

              <p className="text-gray-500 leading-relaxed mb-4">
                Founded in 1998 by U Kelvin Aung in Mandalay, JadePalace began
                as a three-person workshop on 78th Street with a bold vision —
                to bring Myanmar&apos;s finest jadeite to the world with
                complete honesty and meticulous documentation at every step.
              </p>

              <p className="text-gray-500 leading-relaxed mb-4">
                In 2003 we formed our first direct mining partnership with a
                Hpakant cooperative in Kachin State, giving us unbroken
                chain-of-custody from rough stone to finished piece — a standard
                rare in the industry at that time.
              </p>

              <p className="text-gray-500 leading-relaxed">
                Over 26 years we have grown into an internationally recognised
                house, trusted by jewellers, collectors, and auction houses from
                Hong Kong to New York. In 2011 we became the first Myanmar jade
                company to achieve ISO 9001 certification for gemstone grading
                processes.
              </p>
            </div>

            {/* Story Image */}
            <div className="w-full h-full bg-gray-100 overflow-hidden">
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
              { num: "80+", label: "Wholesale Clients" },
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

      {/* ================= Milestones ================= */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="px-6 sm:px-12 lg:px-20 py-20">
          <p className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2">
            Company History
          </p>
          <h2 className="text-3xl font-light text-gray-900 mb-12">
            Key Milestones
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-8">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-6">
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
          <p className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2">
            Leadership
          </p>
          <h2 className="text-3xl font-light text-gray-900 mb-12">
            The People Behind JadePalace
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((person, i) => (
              <div key={i} className="bg-white border border-gray-100 p-6">
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
          <p className="text-xs tracking-[0.25em] uppercase text-green-700 mb-2">
            Credentials
          </p>
          <h2 className="text-3xl font-light text-gray-900 mb-12">
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
                  "Pieces valued above USD 10,000 are recorded on an immutable distributed ledger. Certificate QR codes link directly to on-chain provenance records. Launched 2022.",
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
              <div key={i} className="border border-gray-100 p-6">
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
          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Location Image */}
            <div className="w-full h-full bg-gray-100 overflow-hidden">
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
                  <div key={i}>
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
      <footer className="border-t border-gray-100 px-6 sm:px-12 lg:px-20 py-8 flex flex-col sm:flex-row items-center justify-between gap-2">
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

