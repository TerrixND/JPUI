import PageHeader from "@/components/ui/dashboard/PageHeader";

const salespersons = [
  { id: "sp-01", name: "Jackson Lee",    email: "jackson.lee@jadepalace.com",  branch: "Downtown HQ",     status: "ACTIVE",     sales: "$24,500", appointments: 18, possessions: 12 },
  { id: "sp-02", name: "Emma Rodriguez", email: "emma.r@jadepalace.com",       branch: "Downtown HQ",     status: "ACTIVE",     sales: "$31,200", appointments: 24, possessions: 15 },
  { id: "sp-03", name: "Oliver Brown",   email: "oliver.b@jadepalace.com",     branch: "Westside Branch",  status: "ACTIVE",     sales: "$18,900", appointments: 12, possessions: 8 },
  { id: "sp-04", name: "Ava Williams",   email: "ava.w@jadepalace.com",        branch: "North Point",      status: "RESTRICTED", sales: "$9,100",  appointments: 6,  possessions: 4 },
  { id: "sp-05", name: "Noah Martinez",  email: "noah.m@jadepalace.com",       branch: "Westside Branch",  status: "ACTIVE",     sales: "$22,300", appointments: 15, possessions: 11 },
  { id: "sp-06", name: "Mia Johnson",    email: "mia.j@jadepalace.com",        branch: "North Point",      status: "ACTIVE",     sales: "$27,800", appointments: 20, possessions: 14 },
];

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":     return "bg-green-100 text-green-700";
    case "RESTRICTED": return "bg-yellow-100 text-yellow-700";
    case "BANNED":     return "bg-red-100 text-red-600";
    case "TERMINATED": return "bg-gray-200 text-gray-500";
    default:           return "bg-gray-100 text-gray-600";
  }
}

export default function ManagerSalespersons() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Salesperson Management"
        description="Monitor performance, manage status, and view possessions for your branch salespersons."
      />

      <div className="flex flex-wrap gap-2">
        {["PATCH /manager/salespersons/:id/status", "GET /manager/salespersons/:id/performance", "GET /manager/salespersons/:id/possessions"].map((ep) => (
          <span key={ep} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">{ep}</span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                <th className="px-5 py-3 font-medium">Salesperson</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Sales</th>
                <th className="px-5 py-3 font-medium">Appts</th>
                <th className="px-5 py-3 font-medium">Possessions</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salespersons.map((sp) => (
                <tr key={sp.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{sp.name}</p>
                    <p className="text-xs text-gray-400">{sp.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{sp.branch}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(sp.status)}`}>{sp.status}</span>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{sp.sales}</td>
                  <td className="px-5 py-3 text-gray-600">{sp.appointments}</td>
                  <td className="px-5 py-3 text-gray-600">{sp.possessions}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button className="text-amber-600 hover:text-amber-800 text-xs font-medium">Performance</button>
                    <button className="text-gray-400 hover:text-gray-600 text-xs font-medium">Status</button>
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

