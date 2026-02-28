"use client";

import Link from "next/link";

export default function AuthenticityLandingPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-20 text-stone-900 sm:px-12 lg:px-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">
          Authenticity
        </p>
        <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
          Verify a Jade Palace certification
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600">
          Open a specific authenticity record to review the certificate flow, ownership details,
          and verification timeline for a product.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Browse Products
          </Link>
          <Link
            href="/"
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
