import PageHeader from "@/components/ui/dashboard/PageHeader";

const products = [
  { id: "PRD-001", name: "Widget Pro",     category: "Electronics", price: "$129.99", status: "ACTIVE",      media: 3 },
  { id: "PRD-002", name: "Gadget X",       category: "Accessories", price: "$49.99",  status: "ACTIVE",      media: 2 },
  { id: "PRD-003", name: "Widget Pro Max", category: "Electronics", price: "$249.99", status: "ACTIVE",      media: 5 },
  { id: "PRD-004", name: "Smart Sensor",   category: "IoT",         price: "$89.00",  status: "DRAFT",       media: 0 },
  { id: "PRD-005", name: "Turbo Charger",  category: "Electronics", price: "$34.99",  status: "DISCONTINUED", media: 1 },
  { id: "PRD-006", name: "Flex Cable",     category: "Accessories", price: "$12.50",  status: "ACTIVE",      media: 1 },
];

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":       return "bg-green-100 text-green-700";
    case "DRAFT":        return "bg-gray-100 text-gray-600";
    case "DISCONTINUED": return "bg-red-100 text-red-600";
    default:             return "bg-gray-100 text-gray-600";
  }
}

export default function AdminProducts() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Create, update, and manage the product catalog."
        action={
          <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
            + New Product
          </button>
        }
      />

      {/* API reference */}
      <div className="flex flex-wrap gap-2">
        {["POST /admin/products", "PATCH /admin/products/:id", "PATCH /admin/products/:id/status"].map((ep) => (
          <span key={ep} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">{ep}</span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Media</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{p.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-5 py-3 text-gray-600">{p.category}</td>
                  <td className="px-5 py-3 text-gray-600">{p.price}</td>
                  <td className="px-5 py-3 text-gray-500">{p.media} file{p.media !== 1 ? "s" : ""}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-gray-400 hover:text-gray-600 text-xs font-medium mr-3">Edit</button>
                    <button className="text-gray-400 hover:text-red-600 text-xs font-medium">Status</button>
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

