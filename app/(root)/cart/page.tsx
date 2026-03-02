"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cart_item_data } from "@/utils/data";

type CartItem = {
  id: string;
  name: string;
  sku: string;
  color: string;
  image: string;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  const fetchData = () => {
    try {
      setItems(cart_item_data);
    } catch (err) {
      console.error("Failed to load cart items:", err);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const selectedCount = useMemo(() => items.length, [items]);

  const skuList = useMemo(() => items.map((item) => item.sku), [items]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-20">
        <h1 className="text-2xl font-light tracking-widest mb-4">
          Your Selection is Empty
        </h1>
        <p className="text-gray-400 text-center max-w-md mb-8">
          Add exceptional jade pieces to begin a private consultation.
        </p>
        <Link
          href="/products"
          className="px-8 py-3 border border-black text-sm tracking-widest hover:bg-black hover:text-white transition"
        >
          Explore Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 sm:px-12 lg:px-20 py-20">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-semibold text-black tracking-tight flex items-center gap-1">
          Your Cart
          {selectedCount > 0 && (
            <span className="px-2.5 py-0.5 text-sm font-medium">
              [{selectedCount}]
            </span>
          )}
        </h3>
      </div>
      <div className="mb-12 bg-gray-50 border border-gray-200 p-4">
        <p className="text-sm text-gray-600 leading-relaxed tracking-wide">
          Review the itmes you’ve chosen and proceed to a private discussion
          with our specialists for further details and availability.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-16 mt-5">
        {/* LEFT: Items */}
        <div className="lg:col-span-2 space-y-14">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col md:flex-row gap-10 border-b border-gray-200 pb-14"
            >
              <div className="relative w-full md:w-56 h-72 bg-gray-100 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover hover:scale-105 transition duration-500"
                />
              </div>

              <div className="flex flex-col justify-between flex-1">
                <div className="space-y-4">
                  <h2 className="text-xl font-light tracking-wide">
                    {item.name}
                  </h2>

                  <div className="text-sm text-gray-500 space-y-2 tracking-wide">
                    <p>
                      <span className="uppercase text-stone-400">SKU:</span>{" "}
                      {item.sku}
                    </p>
                    <p>
                      <span className="uppercase text-stone-400">Color:</span>{" "}
                      {item.color}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="mt-8 text-xs uppercase tracking-widest text-stone-400 hover:text-black transition self-start cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: Consultation Summary */}
        <div className="bg-gray-50 p-10 h-fit sticky top-24 border border-gray-200">
          <h2 className="text-2xl font-light mb-10 tracking-wide">
            Consultation Summary
          </h2>

          <div className="space-y-6 text-sm tracking-wide text-gray-600">
            <div className="flex justify-between">
              <span>Total Selected</span>
              <span>{selectedCount}</span>
            </div>

            <div>
              <p className="uppercase text-gray-400 text-xs mb-3">
                Selected SKUs
              </p>
              <div className="space-y-1">
                {skuList.map((sku) => (
                  <p key={sku} className="text-gray-600">
                    {sku}
                  </p>
                ))}
              </div>
            </div>

            <div className="border-t pt-5 text-gray-500 text-sm">
              Our specialists will review these selected items and assist you
              with detailed information, certification, and availability.
            </div>
          </div>

          <button className="w-full mt-8 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white py-4 tracking-widest text-sm transition cursor-pointer">
            Reserve Items
          </button>

          <Link
            href="/products"
            className="block text-center mt-6 text-xs uppercase tracking-widest text-gray-400 hover:text-black transition"
          >
            Continue Exploring
          </Link>
        </div>
      </div>
    </div>
  );
}
