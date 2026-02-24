"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Mock data (will be replaced with real API calls later)              */
/* ------------------------------------------------------------------ */

const stats = [
  {
    label: "Total Products",
    value: "342",
    change: "+18 this month",
    up: true,
    accent: "bg-blue-50 text-blue-600 border-blue-100",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: "Active Users",
    value: "1,209",
    change: "+5.3%",
    up: true,
    accent: "bg-emerald-50 text-emerald-600 border-emerald-100",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
  },
  {
    label: "Branches",
    value: "12",
    change: "+2 new",
    up: true,
    accent: "bg-purple-50 text-purple-600 border-purple-100",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "Pending Requests",
    value: "23",
    change: "-8 from yesterday",
    up: false,
    accent: "bg-amber-50 text-amber-600 border-amber-100",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
];

const branchOverview = [
  { name: "Downtown HQ", code: "DTH", members: 32, revenue: "$128,400", growth: "+12%", status: "Active" },
  { name: "Westside Branch", code: "WSB", members: 18, revenue: "$74,200", growth: "+8%", status: "Active" },
  { name: "North Point", code: "NTP", members: 24, revenue: "$96,800", growth: "+15%", status: "Active" },
  { name: "East Village", code: "EVG", members: 12, revenue: "$45,100", growth: "+3%", status: "Active" },
  { name: "South Bay", code: "SBY", members: 8, revenue: "$22,600", growth: "N/A", status: "New" },
];

const auditLog = [
  { action: "Product created", user: "admin@jadepalace.com", target: "Widget Pro Max", time: "5 min ago", color: "bg-emerald-400" },
  { action: "User status changed", user: "admin@jadepalace.com", target: "jackson.lee", time: "22 min ago", color: "bg-blue-400" },
  { action: "Inventory approved", user: "admin@jadepalace.com", target: "REQ-1042", time: "1 hour ago", color: "bg-purple-400" },
  { action: "Staff rule created", user: "admin@jadepalace.com", target: "SALES onboarding", time: "3 hours ago", color: "bg-amber-400" },
  { action: "Product status updated", user: "admin@jadepalace.com", target: "Gadget X", time: "5 hours ago", color: "bg-gray-400" },
];

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ApiErrorPayload = {
  message?: string;
  code?: string;
  reason?: string;
};

type InventoryProfitSnapshot = {
  totals: {
    productCount: number;
    pricedProductCount: number;
    unpricedProductCount: number;
    projectedRevenueMin: number;
    projectedRevenueMax: number;
    projectedNetProfitMin: number;
    projectedNetProfitMax: number;
  };
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyRange = (min: number, max: number) => {
  if (min === max) return money.format(min);
  return `${money.format(min)} – ${money.format(max)}`;
};

const toErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  const message = payload?.message || fallback;
  const code = payload?.code ? ` (code: ${payload.code})` : "";
  const reason = payload?.reason ? ` (reason: ${payload.reason})` : "";
  return `${message}${code}${reason}`;
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const [profitSnapshot, setProfitSnapshot] = useState<InventoryProfitSnapshot | null>(null);
  const [profitError, setProfitError] = useState("");
  const [profitLoading, setProfitLoading] = useState(true);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const accessToken = session?.access_token || "";

    if (!accessToken) {
      throw new Error("Missing access token. Please sign in again.");
    }

    return accessToken;
  }, []);

  const loadProjectedProfit = useCallback(async () => {
    setProfitLoading(true);
    setProfitError("");

    try {
      const accessToken = await getAccessToken();

      const response = await fetch("/api/v1/admin/analytics/inventory-profit?includeSold=true", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | InventoryProfitSnapshot
        | null;

      if (!response.ok) {
        throw new Error(
          toErrorMessage(payload as ApiErrorPayload | null, "Failed to load projected inventory profit."),
        );
      }

      setProfitSnapshot(payload as InventoryProfitSnapshot);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load projected inventory profit.";

      setProfitSnapshot(null);
      setProfitError(message);
    } finally {
      setProfitLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadProjectedProfit();
  }, [loadProjectedProfit]);

  const t = profitSnapshot?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="System-wide overview of Jade Palace operations."
      />

      {/* ============================================================= */}
      {/* Quick stats                                                    */}
      {/* ============================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-3 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg border ${s.accent}`}>{s.icon}</div>
              {s.change && (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    s.up
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {s.change}
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ============================================================= */}
      {/* Projected inventory profit                                     */}
      {/* ============================================================= */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8M14 7h7v7" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Projected Inventory Profit</h2>
          </div>
          {!profitLoading && !profitError && (
            <button
              type="button"
              onClick={() => void loadProjectedProfit()}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </button>
          )}
        </div>

        {profitLoading && (
          <div className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-7 w-32 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!profitLoading && profitError && (
          <div className="px-5 py-8 text-center">
            <svg className="w-8 h-8 text-red-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-600">{profitError}</p>
            <button
              type="button"
              onClick={() => void loadProjectedProfit()}
              className="mt-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!profitLoading && !profitError && t && (
          <div className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Tracked Products */}
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Tracked Products</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{t.productCount.toLocaleString()}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[11px] text-gray-500">{t.pricedProductCount} priced</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-[11px] text-gray-400">{t.unpricedProductCount} unpriced</span>
                </div>
              </div>

              {/* Priced / Unpriced ratio */}
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Price Coverage</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {t.productCount > 0
                    ? `${Math.round((t.pricedProductCount / t.productCount) * 100)}%`
                    : "0%"}
                </p>
                <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${t.productCount > 0 ? (t.pricedProductCount / t.productCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Projected Revenue */}
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Projected Revenue</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1 break-words">
                  {moneyRange(t.projectedRevenueMin, t.projectedRevenueMax)}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] text-purple-600 mt-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  Revenue range
                </span>
              </div>

              {/* Projected Net Profit */}
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Projected Net Profit</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 break-words">
                  {moneyRange(t.projectedNetProfitMin, t.projectedNetProfitMax)}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 mt-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
                  </svg>
                  Net profit range
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* Branch overview + Audit log side-by-side                       */}
      {/* ============================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ------ Branch Network ------ */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Branch Network</h2>
            <span className="ml-auto text-[11px] text-gray-400 hidden sm:inline">{branchOverview.length} branches</span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider bg-gray-50/60 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">Members</th>
                  <th className="px-5 py-3 font-medium">Revenue</th>
                  <th className="px-5 py-3 font-medium">Growth</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {branchOverview.map((b) => (
                  <tr key={b.name} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {b.code}
                        </span>
                        <span className="font-medium text-gray-900">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{b.members}</td>
                    <td className="px-5 py-3 text-gray-900 font-medium">{b.revenue}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium ${b.growth === "N/A" ? "text-gray-400" : "text-emerald-600"}`}>
                        {b.growth}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          b.status === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {branchOverview.map((b) => (
              <div key={b.name} className="px-4 py-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {b.code}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                        b.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">{b.members} members</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs font-medium text-gray-700">{b.revenue}</span>
                    {b.growth !== "N/A" && (
                      <>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-emerald-600 font-medium">{b.growth}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ------ Recent Activity / Audit Log ------ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-3 space-y-0.5">
              {auditLog.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2.5 group"
                >
                  {/* Timeline dot + connector */}
                  <div className="flex flex-col items-center pt-1.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    {i < auditLog.length - 1 && (
                      <span className="w-px flex-1 bg-gray-100 mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 pb-2">
                    <p className="text-sm text-gray-700 leading-snug">
                      <span className="text-gray-500">{item.action}</span>
                      {" "}
                      <span className="font-medium text-gray-900">{item.target}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Footer link */}
          <div className="px-5 py-3 border-t border-gray-100 shrink-0">
            <p className="text-xs text-gray-400 text-center">
              View full audit log in{" "}
              <span className="text-emerald-600 font-medium">Logs &amp; Backups</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
