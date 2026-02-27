"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRole } from "./RoleContext";
import { useTheme } from "./ThemeContext";
import supabase from "@/lib/supabase";
import { getAdminAuditLogs, type AdminAuditLogRow } from "@/lib/apiClient";

const roleBadge: Record<string, { bg: string; text: string }> = {
  admin:       { bg: "bg-red-100 dark:bg-red-900/40",     text: "text-red-700 dark:text-red-400" },
  manager:     { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-400" },
  salesperson: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-400" },
};

const formatRelativeTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const toActivityDotColor = (action: string) => {
  const normalized = String(action || "").toUpperCase();
  if (normalized.includes("DELETE") || normalized.includes("REMOVE")) return "bg-red-400";
  if (normalized.includes("CREATE")) return "bg-emerald-400";
  if (normalized.includes("UPDATE") || normalized.includes("STATUS")) return "bg-blue-400";
  if (normalized.includes("APPROVE")) return "bg-purple-400";
  return "bg-amber-400";
};

function SunIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
    </svg>
  );
}

export default function Navbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { role, isMainAdmin, dashboardBasePath } = useRole();
  const { theme, toggleTheme } = useTheme();
  const badge = roleBadge[role] ?? roleBadge["salesperson"];
  const roleLabel = isMainAdmin && role === "admin" ? "Main Admin" : role;

  const [notifOpen, setNotifOpen] = useState(false);
  const [activities, setActivities] = useState<AdminAuditLogRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchActivity = useCallback(async () => {
    if (role !== "admin") return;
    setActivityLoading(true);
    setActivityError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token || "";
      if (!accessToken) return;
      const response = await getAdminAuditLogs({ accessToken, page: 1, limit: 6 });
      setActivities(response.items);
    } catch {
      setActivityError("Failed to load recent activity.");
    } finally {
      setActivityLoading(false);
    }
  }, [role]);

  const handleBellClick = useCallback(() => {
    if (role !== "admin") return;
    setNotifOpen((prev) => {
      if (!prev) void fetchActivity();
      return !prev;
    });
  }, [role, fetchActivity]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  const logsHref = `${dashboardBasePath}/logs`;

  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/60 transition-colors duration-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left: hamburger + search */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 w-64 transition-colors">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none w-full"
            />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Role badge */}
          <span
            className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${badge.bg} ${badge.text}`}
          >
            {roleLabel}
          </span>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Notification bell with dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={handleBellClick}
              className="relative p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={role === "admin" ? "Recent Activity" : "Notifications"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Dropdown panel — admin only */}
            {notifOpen && role === "admin" && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl dark:shadow-black/30 overflow-hidden z-50">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-700/40 text-amber-600 dark:text-amber-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchActivity()}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Refresh"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                  </button>
                </div>

                {/* Activity list */}
                <div className="max-h-72 overflow-y-auto">
                  {activityLoading ? (
                    <div className="px-4 py-5 space-y-3.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse flex gap-3">
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activityError ? (
                    <div className="px-4 py-8 text-center">
                      <svg className="w-7 h-7 text-red-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-xs text-red-500 dark:text-red-400">{activityError}</p>
                      <button
                        type="button"
                        onClick={() => void fetchActivity()}
                        className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                      >
                        Retry
                      </button>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                      No recent activity found.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {activities.map((item) => {
                        const target = item.targetId || item.targetType || "Record";
                        const actor = item.actorEmail || item.actorId || "system";
                        const timeLabel = formatRelativeTime(item.createdAt) || "recently";
                        return (
                          <div key={item.id} className="px-4 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors">
                            <div className="flex items-start gap-2.5">
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${toActivityDotColor(item.action)}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
                                  <span className="text-gray-400 dark:text-gray-500">{item.action}</span>{" "}
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{target}</span>
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                  {timeLabel} · {actor}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer link */}
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50">
                  <Link
                    href={logsHref}
                    onClick={() => setNotifOpen(false)}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    View all audit logs
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Profile avatar (mobile) */}
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-semibold lg:hidden">
            {roleLabel[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
