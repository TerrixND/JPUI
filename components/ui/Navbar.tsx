"use client";

import { ShoppingBag, User, Menu, X } from "@boxicons/react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(3);
  const [isScrolled, setIsScrolled] = useState(false);

  const textColor = isScrolled ? "text-black" : "text-white";
  const iconColor = isScrolled ? "text-gray-700" : "text-white";

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "About Us", href: "/aboutus" },
  ];

  // 👇 Detect scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      // 50px = after hero area starts disappearing
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`w-full fixed top-0 left-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-white shadow-md" : "bg-transparent"
      }`}
    >
      {/* Main bar */}
      <div className="px-6 sm:px-12 lg:px-20 py-4 flex justify-between items-center">
        {/* Logo */}
        <h2 className={`text-lg font-semibold ${textColor}`}>Jade Palace</h2>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex gap-10 items-center">
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              className={`text-sm ${textColor} hover:text-gray-500 transition-colors duration-200`}
              href={href}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Icons + Hamburger */}
        <div className="flex gap-10 items-center">
          <button className="relative cursor-pointer">
            <ShoppingBag className={`w-5 h-5 ${iconColor}`} />
            {totalQuantity > 0 && (
              <span className="absolute -top-2 -right-3 bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {totalQuantity}
              </span>
            )}
          </button>

          <button className="hidden md:block cursor-pointer">
            <User className={`w-5 h-5 ${iconColor}`} />
          </button>

          <button
            className="md:hidden cursor-pointer ml-1"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <X className={`w-5 h-5 ${iconColor}`} />
            ) : (
              <Menu className={`w-5 h-5 ${iconColor}`} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden flex flex-col px-6 py-4 gap-4 bg-white border-t border-gray-100">
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              className="text-sm text-black hover:text-gray-500 transition-colors duration-200 py-1"
              href={href}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}

          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 text-sm text-black hover:text-gray-500 transition-colors duration-200 py-1"
          >
            Profile
          </Link>
        </div>
      )}
    </div>
  );
};

export default Navbar;
