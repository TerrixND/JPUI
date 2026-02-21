"use client";

import { Handshake, Stamp, Truck } from "@boxicons/react";
import React from "react";

const processes = [
  {
    icon: Truck,
    title: "Private In-Person Viewing",
    description:
      "We visit your hometown and personally present our collection for a private experience.",
  },
  {
    icon: Stamp,
    title: "Digital Ownership",
    description:
      "Every purchase is securely recorded online, giving you verified proof anytime, anywhere.",
  },
  {
    icon: Handshake,
    title: "Customer Support",
    description:
      "Available Monday–Friday, 10am–5pm. Saturday 11am–3pm at (503) 975-8676.",
  },
];

const OurProcess = () => {
  return (
    <section className="w-full py-20 bg-neutral-100">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* Section Title */}
        {/* <div className="text-center mb-14">
          <p className="text-sm tracking-[0.3em] text-gray-400 uppercase">
            Our Process
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-gray-900 mt-3">
            Seamless & Trusted Experience
          </h2>
        </div> */}

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-12">
          {processes.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex flex-col items-center text-center group"
              >
                {/* Icon */}
                <div className="w-14 h-14 flex items-center justify-center rounded-full border border-gray-300">
                  <Icon className="text-gray-700" />
                </div>

                {/* Title */}
                <h4 className="mt-6 text-lg font-medium text-gray-900">
                  {item.title}
                </h4>

                {/* Description */}
                <p className="mt-3 text-sm text-gray-00 leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default OurProcess;