import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";

const stats = [
  {
    label: "Total Products",
    value: "342",
    change: "+18 this month",
    up: true,
    accent: "bg-blue-50 text-blue-600",
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
    accent: "bg-emerald-50 text-emerald-600",
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
    accent: "bg-purple-50 text-purple-600",
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
    accent: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
];

const branchOverview = [
  { name: "Downtown HQ",     members: 32, revenue: "$128,400", status: "Active" },
  { name: "Westside Branch",  members: 18, revenue: "$74,200",  status: "Active" },
  { name: "North Point",      members: 24, revenue: "$96,800",  status: "Active" },
  { name: "East Village",     members: 12, revenue: "$45,100",  status: "Active" },
  { name: "South Bay",        members: 8,  revenue: "$22,600",  status: "New" },
];

const auditLog = [
  { action: "Product created",       user: "admin@jadepalace.com", target: "Widget Pro Max",  time: "5 min ago" },
  { action: "User status changed",   user: "admin@jadepalace.com", target: "jackson.lee",     time: "22 min ago" },
  { action: "Inventory approved",    user: "admin@jadepalace.com", target: "REQ-1042",        time: "1 hour ago" },
  { action: "Staff rule created",    user: "admin@jadepalace.com", target: "SALES onboarding", time: "3 hours ago" },
  { action: "Product status updated", user: "admin@jadepalace.com", target: "Gadget X",       time: "5 hours ago" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="System-wide overview of Jade Palace operations."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch overview */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Branch Network</h2>
            <span className="text-xs text-gray-400">GET /admin/analytics/branches</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">Members</th>
                  <th className="px-5 py-3 font-medium">Revenue</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {branchOverview.map((b) => (
                  <tr key={b.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{b.name}</td>
                    <td className="px-5 py-3 text-gray-600">{b.members}</td>
                    <td className="px-5 py-3 text-gray-600">{b.revenue}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        b.status === "Active" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit log */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Audit Log</h2>
          </div>
          <div className="p-5 space-y-4">
            {auditLog.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-red-400" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-700">
                    {item.action} &mdash;{" "}
                    <span className="font-medium text-gray-900">{item.target}</span>
                  </p>
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

