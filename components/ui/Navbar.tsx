"use client";

import { ShoppingBag, User, Menu, X } from "@boxicons/react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import useAuth from "@/hooks/useAuth";

const Navbar = ({ heroMode = false }: { heroMode?: boolean }) => {
  const user = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const totalQuantity = 0; // TODO: connect to real cart state
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
      const threshold = heroMode ? window.innerHeight * 2.5 : 50;
      setIsScrolled(window.scrollY > threshold);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`z-100 w-full fixed top-0 left-0 transition-all duration-300 ${
        isScrolled ? "bg-white shadow-md" : "bg-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
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
          {totalQuantity > 0 && (
            <button className="relative cursor-pointer">
              <ShoppingBag className={`w-5 h-5 ${iconColor}`} />
              <span className="absolute -top-2 -right-3 bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {totalQuantity}
              </span>
            </button>
          )}

          {user ? (
            <Link href="/profile" className="hidden md:block">
              <User className={`w-5 h-5 ${iconColor}`} />
            </Link>
          ) : (
            <div className="hidden md:flex gap-3 items-center">
              <Link
                href="/login"
                className={`text-sm ${textColor} hover:opacity-70 transition-opacity duration-200`}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className={`text-sm px-4 py-1.5 border rounded transition-colors duration-200 ${
                  isScrolled
                    ? "border-black text-black hover:bg-black hover:text-white"
                    : "border-white text-white hover:bg-white hover:text-black"
                }`}
              >
                Sign Up
              </Link>
            </div>
          )}

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

          {user ? (
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 text-sm text-black hover:text-gray-500 transition-colors duration-200 py-1"
            >
              Profile
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="text-sm text-black hover:text-gray-500 transition-colors duration-200 py-1"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="text-sm text-black hover:text-gray-500 transition-colors duration-200 py-1"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Navbar;
