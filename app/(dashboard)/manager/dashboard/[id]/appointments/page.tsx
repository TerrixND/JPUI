import PageHeader from "@/components/ui/dashboard/PageHeader";

const appointments = [
  { id: "APT-305", customer: "Isabella Nguyen",  branch: "Downtown HQ",     items: 3, date: "Feb 21, 2026", time: "10:00 AM", status: "PENDING" },
  { id: "APT-304", customer: "William Kim",      branch: "Westside Branch",  items: 1, date: "Feb 21, 2026", time: "11:30 AM", status: "PENDING" },
  { id: "APT-303", customer: "Sofia Davis",      branch: "North Point",      items: 2, date: "Feb 20, 2026", time: "2:00 PM",  status: "PENDING" },
  { id: "APT-302", customer: "Liam Chen",        branch: "Downtown HQ",     items: 5, date: "Feb 20, 2026", time: "3:30 PM",  status: "APPROVED" },
  { id: "APT-301", customer: "Emma Rodriguez",   branch: "Downtown HQ",     items: 2, date: "Feb 19, 2026", time: "9:00 AM",  status: "APPROVED" },
  { id: "APT-300", customer: "Oliver Brown",     branch: "Westside Branch",  items: 1, date: "Feb 19, 2026", time: "1:00 PM",  status: "APPROVED" },
];

function statusStyle(status: string) {
  switch (status) {
    case "PENDING":   return "bg-yellow-100 text-yellow-700";
    case "APPROVED":  return "bg-green-100 text-green-700";
    case "COMPLETED": return "bg-blue-100 text-blue-700";
    case "CANCELLED": return "bg-red-100 text-red-600";
    default:          return "bg-gray-100 text-gray-600";
  }
}

export default function ManagerAppointments() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Review pending appointments and allocate products."
      />

      <div className="flex flex-wrap gap-2">
        {["GET /manager/appointments/pending", "PATCH /manager/appointments/:id/approve", "POST /manager/appointments/:id/possessions"].map((ep) => (
          <span key={ep} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">{ep}</span>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["All", "Pending", "Approved", "Completed"].map((f) => (
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

      {/* Cards view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {appointments.map((apt) => (
          <div key={apt.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-gray-400">{apt.id}</span>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(apt.status)}`}>
                {apt.status}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{apt.customer}</h3>
            <p className="text-xs text-gray-500 mt-1">{apt.branch}</p>

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg py-2">
                <p className="text-xs text-gray-400">Date</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{apt.date}</p>
              </div>
              <div className="bg-gray-50 rounded-lg py-2">
                <p className="text-xs text-gray-400">Time</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{apt.time}</p>
              </div>
              <div className="bg-gray-50 rounded-lg py-2">
                <p className="text-xs text-gray-400">Items</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{apt.items}</p>
              </div>
            </div>

            {apt.status === "PENDING" && (
              <div className="mt-4 flex gap-2">
                <button className="flex-1 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors">
                  Approve
                </button>
                <button className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Allocate Product
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

