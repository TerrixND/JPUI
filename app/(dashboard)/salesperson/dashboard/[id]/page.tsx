import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";

const stats = [
  {
    label: "My Appointments",
    value: "24",
    change: "+3 this week",
    up: true,
    accent: "bg-emerald-50 text-emerald-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Products In Possession",
    value: "15",
    accent: "bg-blue-50 text-blue-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: "Total Sales",
    value: "$31,200",
    change: "+12.8%",
    up: true,
    accent: "bg-purple-50 text-purple-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Commission Earned",
    value: "$2,496",
    change: "+$310 this month",
    up: true,
    accent: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const upcomingAppointments = [
  { id: "APT-310", customer: "Isabella Nguyen", date: "Feb 21, 2026", time: "10:00 AM", items: 3, status: "CONFIRMED" },
  { id: "APT-312", customer: "Liam Chen",       date: "Feb 21, 2026", time: "2:00 PM",  items: 1, status: "CONFIRMED" },
  { id: "APT-315", customer: "Sofia Davis",     date: "Feb 22, 2026", time: "11:00 AM", items: 2, status: "PENDING" },
];

const recentActivity = [
  { text: "Appointment APT-308 completed",       time: "1 hour ago",  dot: "bg-green-500" },
  { text: "New appointment APT-315 assigned",     time: "2 hours ago", dot: "bg-blue-500" },
  { text: "Commission $156 earned on APT-306",   time: "Yesterday",   dot: "bg-purple-500" },
  { text: "Product Widget Pro Max received",      time: "Yesterday",   dot: "bg-amber-500" },
  { text: "Customer rating: 4.8/5 for APT-305",  time: "2 days ago",  dot: "bg-pink-500" },
];

function statusStyle(status: string) {
  switch (status) {
    case "CONFIRMED": return "bg-green-100 text-green-700";
    case "PENDING":   return "bg-yellow-100 text-yellow-700";
    default:          return "bg-gray-100 text-gray-600";
  }
}

export default function SalespersonDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Dashboard"
        description="Your daily overview — appointments, possessions, and performance."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming appointments */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Upcoming Appointments</h2>
          </div>
          <div className="p-5 space-y-3">
            {upcomingAppointments.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{apt.customer}</p>
                    <p className="text-xs text-gray-500">{apt.date} at {apt.time} &middot; {apt.items} item{apt.items !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(apt.status)}`}>
                  {apt.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-5 space-y-4">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-700">{item.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

