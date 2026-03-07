import React from "react";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="w-full bg-white border-t border-gray-200">
      <div className="px-6 sm:px-12 lg:px-20 py-20">

        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">

          {/* Brand */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-semibold tracking-wide text-black">
              Jade Palace
            </h2>

            <p className="mt-6 text-sm text-gray-500 leading-relaxed max-w-md">
              Timeless jade craftsmanship, created with precision and
              dedication. Each piece reflects elegance, rarity, and heritage.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 tracking-wider uppercase">
              Shop
            </h3>

            <ul className="mt-6 space-y-3 text-sm text-gray-500">
              <li><Link href="#" className="hover:text-black transition">Most Asked</Link></li>
              <li><Link href="#" className="hover:text-black transition">Latest Items</Link></li>
              <li><Link href="#" className="hover:text-black transition">Polished</Link></li>
              <li><Link href="#" className="hover:text-black transition">Raw Stone</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 tracking-wider uppercase">
              Company
            </h3>

            <ul className="mt-6 space-y-3 text-sm text-gray-500">
              <li><Link href="#" className="hover:text-black transition">About Us</Link></li>
              <li><Link href="#" className="hover:text-black transition">Our Craft</Link></li>
              <li><Link href="#" className="hover:text-black transition">Sustainability</Link></li>
              <li><Link href="#" className="hover:text-black transition">Contact</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 tracking-wider uppercase">
              Support
            </h3>

            <ul className="mt-6 space-y-3 text-sm text-gray-500">
              <li><Link href="#" className="hover:text-black transition">FAQs</Link></li>
              <li><Link href="#" className="hover:text-black transition">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-black transition">Terms & Conditions</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="mt-20 pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">

          <p>© {new Date().getFullYear()} Jade Palace. All rights reserved.</p>

          <div className="flex space-x-6 mt-6 md:mt-0">
            <Link href="#" className="hover:text-black transition">
              Instagram
            </Link>
            <Link href="#" className="hover:text-black transition">
              Facebook
            </Link>
            <Link href="#" className="hover:text-black transition">
              Line
            </Link>
          </div>

        </div>

      </div>
    </footer>
  );
};

export default Footer;