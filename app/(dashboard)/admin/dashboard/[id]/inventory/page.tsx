import PageHeader from "@/components/ui/dashboard/PageHeader";

const requests = [
  { id: "REQ-1042", branch: "Downtown HQ",     product: "Widget Pro Max", qty: 50,  requestedBy: "Olivia Martin", date: "Feb 20, 2026", status: "PENDING" },
  { id: "REQ-1041", branch: "Westside Branch",  product: "Gadget X",       qty: 100, requestedBy: "Liam Jones",    date: "Feb 19, 2026", status: "PENDING" },
  { id: "REQ-1040", branch: "North Point",      product: "Smart Sensor",   qty: 25,  requestedBy: "Emily Zhang",   date: "Feb 18, 2026", status: "APPROVED" },
  { id: "REQ-1039", branch: "East Village",     product: "Turbo Charger",  qty: 75,  requestedBy: "Marcus Brown",  date: "Feb 17, 2026", status: "APPROVED" },
  { id: "REQ-1038", branch: "Downtown HQ",     product: "Flex Cable",     qty: 200, requestedBy: "Olivia Martin", date: "Feb 16, 2026", status: "REJECTED" },
  { id: "REQ-1037", branch: "South Bay",        product: "Widget Pro",     qty: 30,  requestedBy: "Sarah Wilson",  date: "Feb 15, 2026", status: "APPROVED" },
];

function statusStyle(status: string) {
  switch (status) {
    case "PENDING":  return "bg-yellow-100 text-yellow-700";
    case "APPROVED": return "bg-green-100 text-green-700";
    case "REJECTED": return "bg-red-100 text-red-600";
    default:         return "bg-gray-100 text-gray-600";
  }
}

export default function AdminInventory() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Requests"
        description="Review and decide on inventory requests from branch managers."
      />

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">PATCH /admin/inventory-requests/:requestId/decision</span>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {["All", "Pending", "Approved", "Rejected"].map((f) => (
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
                <th className="px-5 py-3 font-medium">Request</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Requested By</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{r.id}</td>
                  <td className="px-5 py-3 text-gray-900 font-medium">{r.branch}</td>
                  <td className="px-5 py-3 text-gray-600">{r.product}</td>
                  <td className="px-5 py-3 text-gray-600">{r.qty}</td>
                  <td className="px-5 py-3 text-gray-500">{r.requestedBy}</td>
                  <td className="px-5 py-3 text-gray-500">{r.date}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {r.status === "PENDING" ? (
                      <>
                        <button className="text-green-600 hover:text-green-800 text-xs font-medium">Approve</button>
                        <button className="text-red-500 hover:text-red-700 text-xs font-medium">Reject</button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
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

