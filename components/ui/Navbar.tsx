"use client";

import { ShoppingBag, User, Menu, X } from "@boxicons/react";
import Link from "next/link";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useAuth from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { usePathname } from "next/navigation";
import supabase from "@/lib/supabase";
import { getUserMe } from "@/lib/apiClient";
import {
  getDashboardBasePath,
  mapBackendRoleToDashboardRole,
} from "@/lib/roleChecker";
import { gsap } from "gsap";
import Image from "next/image";

const Navbar = ({ heroMode = false }: { heroMode?: boolean }) => {
  const authUser = useAuth();
  const isLoggedIn = Boolean(authUser);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const { count: totalQuantity } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  const whiteRoutes = [
    "/products",
    "/aboutus",
    "/contactus",
    "/cart",
    "/appointment",
    "/authenticity",
    "/profile",
    "/login",
    "/signup",
  ];

  const isWhiteRoute = whiteRoutes.some((route) => pathname.startsWith(route));

  const isLight = isScrolled || isWhiteRoute;

  const textColor = isLight ? "text-black" : "text-white";
  const iconColor = isLight ? "text-gray-700" : "text-white";

  const navLinks = useMemo(() => {
    const links = [
      { label: "Home", href: "/" },
      { label: "Products", href: "/products" },
      { label: "About Us", href: "/aboutus" },
      { label: "Contact Us", href: "/contactus" },
    ];

    if (isLoggedIn) {
      links.push({ label: "Appointment", href: "/appointment" });
    }

    if (dashboardHref) {
      links.push({ label: "Dashboard", href: dashboardHref });
    }

    return links;
  }, [dashboardHref, isLoggedIn]);

  useEffect(() => {
    const handleScroll = () => {
      const threshold = heroMode ? window.innerHeight * 0.7 : 50;
      setIsScrolled(window.scrollY > threshold);
    };

    handleScroll(); // fix refresh state
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, [heroMode]);

  useEffect(() => {
    let isDisposed = false;

    const loadDashboardLink = async () => {
      if (!isLoggedIn) {
        if (!isDisposed) {
          setDashboardHref(null);
        }
        return;
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          if (!isDisposed) {
            setDashboardHref(null);
          }
          return;
        }

        const me = await getUserMe({
          accessToken: session.access_token,
        });

        const dashboardRole = mapBackendRoleToDashboardRole(me.role);
        const userId = me.id || "";

        const isEligible =
          Boolean(dashboardRole) &&
          Boolean(userId) &&
          me.status === "ACTIVE" &&
          me.isSetup;

        if (!isDisposed) {
          setDashboardHref(
            isEligible && dashboardRole
              ? getDashboardBasePath(dashboardRole, userId)
              : null,
          );
        }
      } catch {
        if (!isDisposed) {
          setDashboardHref(null);
        }
      }
    };

    void loadDashboardLink();

    return () => {
      isDisposed = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const menu = mobileMenuRef.current;
    if (!menu) return;

    if (menuOpen) {
      const links = menu.querySelectorAll<HTMLElement>("[data-mobile-link]");

      gsap.set(menu, { autoAlpha: 0, height: 0 });
      gsap.set(links, { autoAlpha: 0, x: -20 });

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      tl.to(menu, {
        autoAlpha: 1,
        height: "auto",
        duration: 0.4,
      }).to(
        links,
        {
          autoAlpha: 1,
          x: 0,
          duration: 0.35,
          stagger: 0.06,
          clearProps: "transform,opacity",
        },
        "-=0.2",
      );
    }
  }, [menuOpen]);

  const handleCloseMenu = useCallback(() => {
    const menu = mobileMenuRef.current;
    if (!menu || isAnimating) return;

    setIsAnimating(true);
    const links = menu.querySelectorAll<HTMLElement>("[data-mobile-link]");

    const tl = gsap.timeline({
      defaults: { ease: "power2.in" },
      onComplete: () => {
        setMenuOpen(false);
        setIsAnimating(false);
      },
    });

    tl.to(links, {
      autoAlpha: 0,
      x: -16,
      duration: 0.2,
      stagger: 0.03,
    }).to(
      menu,
      {
        autoAlpha: 0,
        height: 0,
        duration: 0.3,
      },
      "-=0.1",
    );
  }, [isAnimating]);

  const toggleMenu = useCallback(() => {
    if (isAnimating) return;
    if (menuOpen) {
      handleCloseMenu();
    } else {
      setMenuOpen(true);
    }
  }, [menuOpen, isAnimating, handleCloseMenu]);

  const handleLinkClick = useCallback(() => {
    if (menuOpen) {
      handleCloseMenu();
    }
  }, [menuOpen, handleCloseMenu]);

  return (
    <div
      className={`z-100 w-full fixed top-0 left-0 transition-all duration-300 ${
        isLight ? "bg-white shadow-xs" : "bg-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Main bar */}
      <div className="px-6 sm:px-12 lg:px-20 py-4 flex justify-between items-center">
        {/* Logo */}

        {/* Logo */}
        <Image
          src="/Jade-Palace-LOGO/noBgLogo.svg"
          alt="Jade Palace Logo"
          width={50}
          height={10}
          priority
        />

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
          <Link
            href="/cart"
            className="relative cursor-pointer"
            aria-label="Open appointment cart"
          >
            <ShoppingBag className={`w-5 h-5 ${iconColor}`} />
            {totalQuantity > 0 ? (
              <span className="absolute -top-2 -right-3 bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {totalQuantity}
              </span>
            ) : null}
          </Link>

          {isLoggedIn ? (
            <div className="hidden md:flex gap-6 items-center">
              <Link href="/profile" className="hidden md:block">
                <User className={`w-5 h-5 ${iconColor}`} />
              </Link>
            </div>
          ) : (
            <div className="hidden md:flex gap-6 items-center">
              <Link
                href="/login"
                className={`text-sm ${textColor} hover:opacity-70 transition-opacity duration-200`}
              >
                Login
              </Link>

              <Link
                href="/signup"
                className={`text-sm px-4 py-1.5 border rounded transition-colors duration-200 ${
                  isLight
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
            onClick={toggleMenu}
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

      {/* Mobile Dropdown */}
      {menuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden flex flex-col px-6 py-4 gap-1 bg-white border-t border-gray-100 overflow-hidden"
        >
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              data-mobile-link
              className="text-sm text-black hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors duration-200 py-2.5 px-3 rounded-lg"
              href={href}
              onClick={handleLinkClick}
            >
              {label}
            </Link>
          ))}

          <div data-mobile-link className="my-1 h-px bg-gray-100" />

          {isLoggedIn ? (
            <>
              <Link
                href="/appointment"
                data-mobile-link
                onClick={handleLinkClick}
                className="text-sm text-black hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors duration-200 py-2.5 px-3 rounded-lg"
              >
                Appointment
              </Link>

              <Link
                href="/cart"
                data-mobile-link
                onClick={handleLinkClick}
                className="flex items-center gap-2 text-sm text-black hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors duration-200 py-2.5 px-3 rounded-lg"
              >
                <ShoppingBag className="w-4 h-4" />
                Cart
              </Link>

              <Link
                href="/profile"
                data-mobile-link
                onClick={handleLinkClick}
                className="flex items-center gap-2 text-sm text-black hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors duration-200 py-2.5 px-3 rounded-lg"
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                data-mobile-link
                onClick={handleLinkClick}
                className="text-sm text-black hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors duration-200 py-2.5 px-3 rounded-lg"
              >
                Login
              </Link>

              <Link
                href="/signup"
                data-mobile-link
                onClick={handleLinkClick}
                className="mt-1 text-center text-sm border border-black text-black hover:bg-black hover:text-white transition-colors duration-200 py-2.5 px-3 rounded-lg"
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
