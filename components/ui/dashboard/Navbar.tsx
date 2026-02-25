"use client";

import { useRole } from "./RoleContext";

const roleBadge: Record<string, { bg: string; text: string }> = {
  admin:       { bg: "bg-red-100",    text: "text-red-700" },
  manager:     { bg: "bg-amber-100",  text: "text-amber-700" },
  salesperson: { bg: "bg-emerald-100", text: "text-emerald-700" },
};

export default function Navbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { role, isMainAdmin } = useRole();
  const badge = roleBadge[role];
  const roleLabel = isMainAdmin && role === "admin" ? "Main Admin" : role;

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left: hamburger + search */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search bar */}
          <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-64">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
            />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          {/* Role badge */}
          <span
            className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${badge.bg} ${badge.text}`}
          >
            {roleLabel}
          </span>

          {/* Notification bell */}
          <button className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Profile avatar (mobile) */}
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-semibold lg:hidden">
            {roleLabel[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
