"use client";

import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";
import { useRole } from "@/components/ui/dashboard/RoleContext";

const recentActivity = [
  { text: "Appointment APT-301 approved",     time: "10 min ago",  dot: "bg-green-500" },
  { text: "Product allocated to APT-298",     time: "45 min ago",  dot: "bg-blue-500" },
  { text: "Commission policy set for J. Lee", time: "2 hours ago", dot: "bg-purple-500" },
  { text: "Inventory request REQ-1042 sent",  time: "3 hours ago", dot: "bg-amber-500" },
  { text: "Salesperson status: W. Kim restricted", time: "5 hours ago", dot: "bg-red-500" },
];

const branchSummaries = [
  { name: "Downtown HQ",     appointments: 12, salespersons: 6, totalSales: "$84,200", possessions: 145 },
  { name: "Westside Branch", appointments: 5,  salespersons: 4, totalSales: "$52,100", possessions: 89 },
  { name: "North Point",     appointments: 8,  salespersons: 4, totalSales: "$61,700", possessions: 112 },
];

export default function ManagerDashboard() {
  const { dashboardBasePath } = useRole();

  const stats = [
    {
      label: "My Branches",
      value: "3",
      accent: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
      href: `${dashboardBasePath}/salespersons`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: "Pending Appointments",
      value: "8",
      change: "+3 today",
      up: false,
      accent: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
      href: `${dashboardBasePath}/appointments`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Active Salespersons",
      value: "14",
      accent: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
      href: `${dashboardBasePath}/salespersons`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      label: "Branch Revenue",
      value: "$198K",
      change: "+9.2%",
      up: true,
      accent: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      href: `${dashboardBasePath}/commissions`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager Dashboard"
        description="Overview of your branch operations."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch summary cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">My Branches</h2>
          {branchSummaries.map((b) => (
            <div key={b.name} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 transition-colors">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{b.name}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Appointments</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{b.appointments}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Salespersons</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{b.salespersons}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Sales</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{b.totalSales}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Possessions</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{b.possessions}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 transition-colors">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
          </div>
          <div className="p-5 space-y-4">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{item.text}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
