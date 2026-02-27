import PageHeader from "@/components/ui/dashboard/PageHeader";

const myRequests = [
  { id: "REQ-1042", product: "Widget Pro Max", qty: 50,  appointment: "APT-302", status: "PENDING",  date: "Feb 20, 2026" },
  { id: "REQ-1041", product: "Gadget X",       qty: 100, appointment: "APT-298", status: "PENDING",  date: "Feb 19, 2026" },
  { id: "REQ-1039", product: "Turbo Charger",  qty: 75,  appointment: "APT-295", status: "APPROVED", date: "Feb 17, 2026" },
  { id: "REQ-1037", product: "Widget Pro",     qty: 30,  appointment: "APT-290", status: "APPROVED", date: "Feb 15, 2026" },
  { id: "REQ-1035", product: "Flex Cable",     qty: 200, appointment: "APT-288", status: "REJECTED", date: "Feb 13, 2026" },
];

function statusStyle(status: string) {
  switch (status) {
    case "PENDING":  return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
    case "APPROVED": return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    case "REJECTED": return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
    default:         return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
}

export default function ManagerInventory() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Requests"
        description="Create and track inventory requests for your branches."
        action={
          <button className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
            + New Request
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[11px] font-mono rounded-md">POST /manager/inventory-requests</span>
      </div>

      {/* Form placeholder */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Request</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product</label>
            <select className="w-full border border-gray-200 dark:border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors">
              <option>Select product...</option>
              <option>Widget Pro</option>
              <option>Widget Pro Max</option>
              <option>Gadget X</option>
              <option>Smart Sensor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
            <input type="number" placeholder="0" className="w-full border border-gray-200 dark:border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/50 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Appointment</label>
            <select className="w-full border border-gray-200 dark:border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors">
              <option>Select appointment...</option>
              <option>APT-305</option>
              <option>APT-304</option>
              <option>APT-303</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
              Submit Request
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">My Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                <th className="px-5 py-3 font-medium">Request</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Appointment</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">{r.id}</td>
                  <td className="px-5 py-3 text-gray-900 dark:text-gray-100 font-medium">{r.product}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{r.qty}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{r.appointment}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{r.date}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle(r.status)}`}>{r.status}</span>
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
