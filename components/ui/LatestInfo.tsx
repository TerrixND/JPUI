"use client";

import React from "react";

const LatestInfo = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-3xl lg:text-4xl font-light tracking-tight text-neutral-900">
          Latest from Jade Palace
        </h2>
        <p className="text-sm text-neutral-400 mt-2 tracking-wide">
          Receive updates about new collections and exclusive releases.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors"
          />

          <button className="cursor-pointer px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors">
            Sign Up
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-400">Unsubscribe at any time.</p>
      </div>
    </section>
  );
};

export default LatestInfo;
