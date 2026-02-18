import React from "react";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="w-full bg-white border-t border-gray-200 mt-24">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-20 py-16">
        
        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          
          {/* Brand */}
          <div>
            <h2 className={`text-lg font-semibold text-black`}>Jade Palace</h2>
            <p className="mt-6 text-sm text-gray-500 leading-relaxed">
              Timeless jade craftsmanship, created with precision and
              dedication. Each piece reflects elegance, rarity, and heritage.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 tracking-wide">
              Shop
            </h3>
            <ul className="mt-6 space-y-4 text-sm text-gray-500">
              <li><Link href="#">Necklaces</Link></li>
              <li><Link href="#">Rings</Link></li>
              <li><Link href="#">Earrings</Link></li>
              <li><Link href="#">Bracelets</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 tracking-wide">
              Company
            </h3>
            <ul className="mt-6 space-y-4 text-sm text-gray-500">
              <li><Link href="#">About Us</Link></li>
              <li><Link href="#">Our Craft</Link></li>
              <li><Link href="#">Sustainability</Link></li>
              <li><Link href="#">Contact</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 tracking-wide">
              Support
            </h3>
            <ul className="mt-6 space-y-4 text-sm text-gray-500">
              <li><Link href="#">FAQs</Link></li>
              <li><Link href="#">Privacy Policy</Link></li>
              <li><Link href="#">Terms & Conditions</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} JadePalace. All rights reserved.</p>

          <div className="flex space-x-6 mt-6 md:mt-0">
            <Link href="#" className="hover:text-gray-900 transition">
              Instagram
            </Link>
            <Link href="#" className="hover:text-gray-900 transition">
              Facebook
            </Link>
            <Link href="#" className="hover:text-gray-900 transition">
              Line
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
