"use client";

import PageHeader from "@/components/ui/dashboard/PageHeader";

const possessions = [
  { id: "pos-01", product: "Widget Pro",       serial: "WP-2026-0042", assignedDate: "Feb 15, 2026", appointment: "APT-310", status: "IN_HAND",  value: "THB 129.99" },
  { id: "pos-02", product: "Widget Pro Max",   serial: "WPM-2026-018", assignedDate: "Feb 12, 2026", appointment: "APT-306", status: "IN_HAND",  value: "THB 249.99" },
  { id: "pos-03", product: "Gadget X",         serial: "GX-2026-0125", assignedDate: "Feb 10, 2026", appointment: "APT-303", status: "SOLD",     value: "THB 49.99" },
  { id: "pos-04", product: "Smart Sensor",     serial: "SS-2026-0089", assignedDate: "Feb 08, 2026", appointment: "APT-298", status: "RETURNED", value: "THB 89.00" },
  { id: "pos-05", product: "Flex Cable",       serial: "FC-2026-0201", assignedDate: "Feb 18, 2026", appointment: "APT-312", status: "IN_HAND",  value: "THB 12.50" },
  { id: "pos-06", product: "Widget Pro",       serial: "WP-2026-0043", assignedDate: "Feb 14, 2026", appointment: "APT-308", status: "SOLD",     value: "THB 129.99" },
  { id: "pos-07", product: "Turbo Charger",    serial: "TC-2026-0067", assignedDate: "Feb 06, 2026", appointment: "APT-295", status: "SOLD",     value: "THB 34.99" },
];

function statusStyle(status: string) {
  switch (status) {
    case "IN_HAND":  return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400";
    case "SOLD":     return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400";
    case "RETURNED": return "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300";
    default:         return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
  }
}

export default function SalespersonPossessions() {
  const inHand = possessions.filter((p) => p.status === "IN_HAND").length;
  const sold = possessions.filter((p) => p.status === "SOLD").length;
  const returned = possessions.filter((p) => p.status === "RETURNED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Possessions"
        description="Products currently allocated to you and their status."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-800/40 transition-colors">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{inHand}</p>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-500 mt-1">In Hand</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center border border-green-100 dark:border-green-800/40 transition-colors">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{sold}</p>
          <p className="text-xs font-medium text-green-600 dark:text-green-500 mt-1">Sold</p>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700/60 transition-colors">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{returned}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Returned</p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700/60">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Serial</th>
                <th className="px-5 py-3 font-medium">Appointment</th>
                <th className="px-5 py-3 font-medium">Assigned</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {possessions.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-gray-700/40 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{p.product}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{p.serial}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{p.appointment}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{p.assignedDate}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{p.value}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(p.status)}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {possessions.map((p) => (
          <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.product}</p>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(p.status)}`}>
                {p.status.replace("_", " ")}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Serial</span>
                <span className="font-mono text-gray-600 dark:text-gray-300">{p.serial}</span>
              </div>
              <div className="flex justify-between">
                <span>Appointment</span>
                <span className="font-mono text-gray-600 dark:text-gray-300">{p.appointment}</span>
              </div>
              <div className="flex justify-between">
                <span>Assigned</span>
                <span className="text-gray-600 dark:text-gray-300">{p.assignedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Value</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">{p.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
