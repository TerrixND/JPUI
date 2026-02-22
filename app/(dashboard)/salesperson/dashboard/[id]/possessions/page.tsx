import PageHeader from "@/components/ui/dashboard/PageHeader";

const possessions = [
  { id: "pos-01", product: "Widget Pro",       serial: "WP-2026-0042", assignedDate: "Feb 15, 2026", appointment: "APT-310", status: "IN_HAND",  value: "$129.99" },
  { id: "pos-02", product: "Widget Pro Max",   serial: "WPM-2026-018", assignedDate: "Feb 12, 2026", appointment: "APT-306", status: "IN_HAND",  value: "$249.99" },
  { id: "pos-03", product: "Gadget X",         serial: "GX-2026-0125", assignedDate: "Feb 10, 2026", appointment: "APT-303", status: "SOLD",     value: "$49.99" },
  { id: "pos-04", product: "Smart Sensor",     serial: "SS-2026-0089", assignedDate: "Feb 08, 2026", appointment: "APT-298", status: "RETURNED", value: "$89.00" },
  { id: "pos-05", product: "Flex Cable",       serial: "FC-2026-0201", assignedDate: "Feb 18, 2026", appointment: "APT-312", status: "IN_HAND",  value: "$12.50" },
  { id: "pos-06", product: "Widget Pro",       serial: "WP-2026-0043", assignedDate: "Feb 14, 2026", appointment: "APT-308", status: "SOLD",     value: "$129.99" },
  { id: "pos-07", product: "Turbo Charger",    serial: "TC-2026-0067", assignedDate: "Feb 06, 2026", appointment: "APT-295", status: "SOLD",     value: "$34.99" },
];

function statusStyle(status: string) {
  switch (status) {
    case "IN_HAND":  return "bg-blue-100 text-blue-700";
    case "SOLD":     return "bg-green-100 text-green-700";
    case "RETURNED": return "bg-gray-200 text-gray-500";
    default:         return "bg-gray-100 text-gray-600";
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

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">GET /salesperson/me/possessions</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{inHand}</p>
          <p className="text-xs text-blue-600 mt-1">In Hand</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{sold}</p>
          <p className="text-xs text-green-600 mt-1">Sold</p>
        </div>
        <div className="bg-gray-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-600">{returned}</p>
          <p className="text-xs text-gray-500 mt-1">Returned</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
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
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.product}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.serial}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.appointment}</td>
                  <td className="px-5 py-3 text-gray-600">{p.assignedDate}</td>
                  <td className="px-5 py-3 text-gray-600">{p.value}</td>
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
    </div>
  );
}

