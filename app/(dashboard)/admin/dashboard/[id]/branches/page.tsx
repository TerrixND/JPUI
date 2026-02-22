import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";

const branchStats = [
  {
    label: "Total Branches",
    value: "12",
    accent: "bg-purple-50 text-purple-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "Total Members",
    value: "94",
    accent: "bg-blue-50 text-blue-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
  },
  {
    label: "Network Revenue",
    value: "$367K",
    change: "+12.4%",
    up: true,
    accent: "bg-emerald-50 text-emerald-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const branches = [
  { id: "br-01", name: "Downtown HQ",     manager: "Olivia Martin",  members: 32, possessions: 145, commissions: "$12,400", performance: "98%" },
  { id: "br-02", name: "Westside Branch",  manager: "Liam Jones",     members: 18, possessions: 89,  commissions: "$7,200",  performance: "91%" },
  { id: "br-03", name: "North Point",      manager: "Emily Zhang",    members: 24, possessions: 112, commissions: "$9,800",  performance: "94%" },
  { id: "br-04", name: "East Village",     manager: "Marcus Brown",   members: 12, possessions: 56,  commissions: "$4,100",  performance: "87%" },
  { id: "br-05", name: "South Bay",        manager: "Sarah Wilson",   members: 8,  possessions: 23,  commissions: "$1,800",  performance: "79%" },
];

export default function AdminBranches() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Network"
        description="Overview of all branches — members, possessions, performance, and commissions."
      />

      <div className="flex flex-wrap gap-2">
        {["GET /admin/analytics/branches", "GET /admin/branches/:id/members", "GET /admin/branches/:id/possessions", "GET /admin/branches/:id/performance", "GET /admin/branches/:id/commissions"].map((ep) => (
          <span key={ep} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">{ep}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {branchStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Manager</th>
                <th className="px-5 py-3 font-medium">Members</th>
                <th className="px-5 py-3 font-medium">Possessions</th>
                <th className="px-5 py-3 font-medium">Commissions</th>
                <th className="px-5 py-3 font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{b.name}</td>
                  <td className="px-5 py-3 text-gray-600">{b.manager}</td>
                  <td className="px-5 py-3 text-gray-600">{b.members}</td>
                  <td className="px-5 py-3 text-gray-600">{b.possessions}</td>
                  <td className="px-5 py-3 text-gray-600">{b.commissions}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: b.performance }} />
                      </div>
                      <span className="text-xs text-gray-500">{b.performance}</span>
                    </div>
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

