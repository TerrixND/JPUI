"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";

const appointments = [
  { id: "APT-315", customer: "Sofia Davis",      date: "Feb 22, 2026", time: "11:00 AM", items: 2, branch: "Downtown HQ",     status: "PENDING" },
  { id: "APT-312", customer: "Liam Chen",        date: "Feb 21, 2026", time: "2:00 PM",  items: 1, branch: "Downtown HQ",     status: "CONFIRMED" },
  { id: "APT-310", customer: "Isabella Nguyen",  date: "Feb 21, 2026", time: "10:00 AM", items: 3, branch: "Downtown HQ",     status: "CONFIRMED" },
  { id: "APT-308", customer: "Oliver Brown",     date: "Feb 20, 2026", time: "3:30 PM",  items: 2, branch: "Downtown HQ",     status: "COMPLETED" },
  { id: "APT-306", customer: "Emma Rodriguez",   date: "Feb 19, 2026", time: "9:00 AM",  items: 1, branch: "Downtown HQ",     status: "COMPLETED" },
  { id: "APT-303", customer: "Ava Williams",     date: "Feb 18, 2026", time: "1:00 PM",  items: 4, branch: "Downtown HQ",     status: "COMPLETED" },
  { id: "APT-298", customer: "Noah Martinez",    date: "Feb 16, 2026", time: "10:30 AM", items: 2, branch: "Downtown HQ",     status: "CANCELLED" },
];

const FILTERS = ["All", "Pending", "Confirmed", "Completed", "Cancelled"] as const;

function statusStyle(status: string) {
  switch (status) {
    case "PENDING":   return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400";
    case "CONFIRMED": return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400";
    case "COMPLETED": return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400";
    case "CANCELLED": return "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400";
    default:          return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
  }
}

export default function SalespersonAppointments() {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const filtered = activeFilter === "All"
    ? appointments
    : appointments.filter((a) => a.status === activeFilter.toUpperCase());

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        description="View all your assigned appointments and update their status."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFilter === f
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/70"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700/60">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((apt) => (
                <tr key={apt.id} className="border-b border-gray-50 dark:border-gray-700/40 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">{apt.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{apt.customer}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{apt.date}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{apt.time}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{apt.items}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(apt.status)}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(apt.status === "PENDING" || apt.status === "CONFIRMED") ? (
                      <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-colors">
                        <option>Update Status</option>
                        <option>IN_PROGRESS</option>
                        <option>COMPLETED</option>
                        <option>CANCELLED</option>
                      </select>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                    No appointments match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map((apt) => (
          <div key={apt.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{apt.id}</span>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(apt.status)}`}>
                {apt.status}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{apt.customer}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{apt.date}</span>
              <span>{apt.time}</span>
              <span>{apt.items} item{apt.items !== 1 ? "s" : ""}</span>
            </div>
            {(apt.status === "PENDING" || apt.status === "CONFIRMED") && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                <select className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-2 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-colors">
                  <option>Update Status</option>
                  <option>IN_PROGRESS</option>
                  <option>COMPLETED</option>
                  <option>CANCELLED</option>
                </select>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
            No appointments match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
