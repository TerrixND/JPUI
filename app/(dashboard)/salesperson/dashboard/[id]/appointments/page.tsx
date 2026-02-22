"use client";

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

function statusStyle(status: string) {
  switch (status) {
    case "PENDING":   return "bg-yellow-100 text-yellow-700";
    case "CONFIRMED": return "bg-blue-100 text-blue-700";
    case "COMPLETED": return "bg-green-100 text-green-700";
    case "CANCELLED": return "bg-red-100 text-red-600";
    default:          return "bg-gray-100 text-gray-600";
  }
}

export default function SalespersonAppointments() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        description="View all your assigned appointments and update their status."
      />

      <div className="flex flex-wrap gap-2">
        {["GET /salesperson/me/appointments", "PATCH /salesperson/me/appointments/:id/status"].map((ep) => (
          <span key={ep} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">{ep}</span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["All", "Pending", "Confirmed", "Completed", "Cancelled"].map((f) => (
          <button
            key={f}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              f === "All"
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
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
              {appointments.map((apt) => (
                <tr key={apt.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{apt.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{apt.customer}</td>
                  <td className="px-5 py-3 text-gray-600">{apt.date}</td>
                  <td className="px-5 py-3 text-gray-600">{apt.time}</td>
                  <td className="px-5 py-3 text-gray-600">{apt.items}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(apt.status)}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(apt.status === "PENDING" || apt.status === "CONFIRMED") ? (
                      <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600">
                        <option>Update Status</option>
                        <option>IN_PROGRESS</option>
                        <option>COMPLETED</option>
                        <option>CANCELLED</option>
                      </select>
                    ) : (
                      <span className="text-xs text-gray-300">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

