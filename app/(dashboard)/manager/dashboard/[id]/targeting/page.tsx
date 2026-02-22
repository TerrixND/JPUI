import PageHeader from "@/components/ui/dashboard/PageHeader";

const products = [
  { id: "PRD-001", name: "Widget Pro",     targetedUsers: 42,  branches: ["Downtown HQ", "Westside Branch"], active: true },
  { id: "PRD-003", name: "Widget Pro Max", targetedUsers: 18,  branches: ["Downtown HQ"],                    active: true },
  { id: "PRD-002", name: "Gadget X",       targetedUsers: 65,  branches: ["All Branches"],                   active: true },
  { id: "PRD-004", name: "Smart Sensor",   targetedUsers: 0,   branches: [],                                 active: false },
  { id: "PRD-006", name: "Flex Cable",     targetedUsers: 12,  branches: ["North Point"],                    active: true },
];

export default function ManagerTargeting() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Targeting"
        description="Configure which products are targeted to specific customer segments."
      />

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">PATCH /manager/products/:productId/targeting</span>
      </div>

      {/* Product targeting cards */}
      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-gray-400">{p.id}</span>
                <span className={`inline-block w-2 h-2 rounded-full ${p.active ? "bg-green-500" : "bg-gray-300"}`} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {p.branches.length > 0 ? (
                  p.branches.map((b) => (
                    <span key={b} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[11px] font-medium rounded">
                      {b}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">No branches targeted</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{p.targetedUsers}</p>
                <p className="text-[11px] text-gray-400">Targeted Users</p>
              </div>
              <button className="px-3 py-1.5 border border-amber-200 text-amber-600 text-xs font-medium rounded-lg hover:bg-amber-50 transition-colors">
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

