import PageHeader from "@/components/ui/dashboard/PageHeader";

const policies = [
  { id: "pol-01", name: "Standard 5%",       rate: "5%",   type: "Percentage", branch: "Downtown HQ",     appliesTo: "All Salespersons", createdAt: "Jan 15, 2026" },
  { id: "pol-02", name: "Senior 8%",          rate: "8%",   type: "Percentage", branch: "Downtown HQ",     appliesTo: "Senior Staff",     createdAt: "Jan 20, 2026" },
  { id: "pol-03", name: "Westside Flat $50", rate: "$50",  type: "Flat",       branch: "Westside Branch",  appliesTo: "All Salespersons", createdAt: "Feb 01, 2026" },
  { id: "pol-04", name: "North Tiered",       rate: "3-10%", type: "Tiered",    branch: "North Point",      appliesTo: "All Salespersons", createdAt: "Feb 05, 2026" },
];

function typeBadge(type: string) {
  switch (type) {
    case "Percentage": return "bg-blue-100 text-blue-700";
    case "Flat":       return "bg-purple-100 text-purple-700";
    case "Tiered":     return "bg-amber-100 text-amber-700";
    default:           return "bg-gray-100 text-gray-600";
  }
}

export default function ManagerCommissions() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Policies"
        description="Set commission policies for salespersons in your branches."
        action={
          <button className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
            + New Policy
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">POST /manager/commission-policies</span>
      </div>

      {/* Policy cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {policies.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadge(p.type)}`}>
                {p.type}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400">Rate</p>
                <p className="text-lg font-bold text-gray-900">{p.rate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Branch</p>
                <p className="text-sm font-medium text-gray-700">{p.branch}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Applies To</p>
                <p className="text-sm text-gray-600">{p.appliesTo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Created</p>
                <p className="text-sm text-gray-600">{p.createdAt}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

