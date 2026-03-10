"use client";

import React from "react";

const LatestInfo = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2
          data-scroll-reveal
          className="text-3xl lg:text-4xl font-light tracking-tight text-neutral-900"
        >
          Latest from Jade Palace
        </h2>
        <p
          data-scroll-reveal
          className="text-sm text-neutral-400 mt-2 tracking-wide"
        >
          Receive updates about new collections and exclusive releases.
        </p>

        <div
          data-scroll-reveal
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors"
          />

          <button
            data-home-hover="button"
            className="cursor-pointer rounded-md bg-gray-900 px-6 py-3 text-white transition-colors hover:bg-gray-800"
          >
            Sign Up
          </button>
        </div>

        <p data-scroll-reveal className="mt-4 text-xs text-gray-400">
          Unsubscribe at any time.
        </p>
      </div>
    </section>
  );
};

export default LatestInfo;
