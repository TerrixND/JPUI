"use client";
import React, { useEffect, useState } from "react";
import ProductDetailClientComponent from "./ProductDetailClient";

type Product = any;

const steps = [
  {
    number: "01",
    title: "Acquisition",
    desc: "Every artifact is sourced exclusively from licensed dealers, reputable auction houses, and documented private collections.",
  },
  {
    number: "02",
    title: "Expert Examination",
    desc: "Rigorous physical and scientific analysis by senior curators and material specialists.",
  },
  {
    number: "03",
    title: "Laboratory Testing",
    desc: "Thermoluminescence dating, X-ray fluorescence, and spectroscopic verification.",
  },
  {
    number: "04",
    title: "Provenance Research",
    desc: "Cross-referenced ownership history with museum archives and auction records.",
  },
  {
    number: "05",
    title: "Certification & Seal",
    desc: "Numbered Jade Palace Certificate secured with tamper-evident seal.",
  },
];

const AuthenticityClientComponent = ({ product }: { product: Product }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <ProductDetailClientComponent product={product} />

      {/* PROCESS */}
      <section className="px-6 sm:px-12 lg:px-20 py-20">
        <p className="text-xs tracking-[0.4em] uppercase text-emerald-600 mb-12">
          Authentication Process
        </p>

        <div className="grid md:grid-cols-5 gap-8">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`transition-all duration-700 ${
                visible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <span className="text-4xl font-light text-stone-300 block mb-3">
                {step.number}
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 mb-4" />
              <h3 className="text-sm font-medium tracking-wider uppercase text-stone-800 mb-2">
                {step.title}
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CERTIFICATES */}
      <section className="px-6 sm:px-12 lg:px-20 pb-20">
        <div className="border-t border-stone-200 mb-16" />

        <p className="text-xs tracking-[0.4em] uppercase text-emerald-600 mb-4">
          Verified Collection
        </p>
        <h2 className="text-3xl font-light text-stone-900 mb-10">
          Recent Certifications
        </h2>

        <div className="space-y-4">
          {product?.certificate && (
            <div
              key={product.certificate.id}
              className={`cursor-pointer bg-white border rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ${
                selected === product.certificate.id
                  ? "border-emerald-400"
                  : "border-stone-200"
              }`}
              onClick={() =>
                setSelected(
                  selected === product.certificate.id
                    ? null
                    : product.certificate.id,
                )
              }
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-6">
                  <span className="text-xs font-mono text-stone-600">
                    {product.certificate.serialNumber}
                  </span>

                  <span className="text-stone-900 text-lg font-light">
                    Certificate of Authenticity
                  </span>

                  <span className="hidden md:block text-xs text-stone-500">
                    {product.certificate.gemGrade}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {product.certificate.status}
                  </span>

                  <span
                    className={`text-stone-500 text-lg transition-transform duration-300 ${
                      selected === product.certificate.id ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </div>
              </div>

              {/* Expanded */}
              {selected === product.certificate.id && (
                <div className="px-6 pb-6 border-t border-stone-200 pt-5">
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      ["Origin", product.certificate.origin],
                      ["Gem Grade", product.certificate.gemGrade],
                      ["Issued By", product.certificate.issuedBy],
                      ["Authenticated By", product.certificate.authenticatedBy],
                      [
                        "Registered At",
                        new Date(
                          product.certificate.registeredAt,
                        ).toLocaleDateString(),
                      ],
                      ["Current Holder", product.certificate.currentHolder],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs tracking-widest uppercase text-stone-500 mb-1">
                          {label}
                        </p>
                        <p className="text-stone-800 text-sm">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Section */}
                  <div className="mt-6 pt-5 border-t border-stone-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-600 tracking-widest uppercase">
                        Serial Number
                      </p>
                      <p className="text-xs font-mono text-stone-600">
                        {product.certificate.serialNumber}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <a
                        href={product.certificate.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs tracking-[0.2em] uppercase border border-stone-300 text-stone-700 hover:bg-stone-100 px-5 py-2 transition"
                      >
                        Verify
                      </a>

                      <a
                        href={product.certificate.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs tracking-[0.2em] uppercase border border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white px-5 py-2 transition"
                      >
                        Download PDF
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="border-t border-stone-200 bg-stone-50">
        <div className="px-6 sm:px-12 lg:px-20 py-16 grid md:grid-cols-3 gap-8 text-center">
          {[
            ["30+", "Years of Expertise"],
            ["1,200+", "Artifacts Certified"],
            ["100%", "Guarantee of Authenticity"],
          ].map(([num, label]) => (
            <div key={label}>
              <p className="text-4xl font-light text-emerald-500 mb-2">{num}</p>
              <p className="text-xs tracking-[0.25em] uppercase text-stone-500">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AuthenticityClientComponent;
