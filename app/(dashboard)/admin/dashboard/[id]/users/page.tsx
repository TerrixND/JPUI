import PageHeader from "@/components/ui/dashboard/PageHeader";

const users = [
  { id: "usr-01", email: "olivia.martin@jadepalace.com",  role: "MANAGER",  status: "ACTIVE",     joined: "Jan 12, 2026" },
  { id: "usr-02", email: "jackson.lee@jadepalace.com",    role: "SALES",    status: "ACTIVE",     joined: "Feb 03, 2026" },
  { id: "usr-03", email: "isabella.nguyen@gmail.com",     role: "CUSTOMER", status: "ACTIVE",     joined: "Feb 10, 2026" },
  { id: "usr-04", email: "william.kim@jadepalace.com",    role: "SALES",    status: "RESTRICTED", joined: "Dec 20, 2025" },
  { id: "usr-05", email: "sofia.davis@gmail.com",         role: "CUSTOMER", status: "BANNED",     joined: "Nov 15, 2025" },
  { id: "usr-06", email: "liam.jones@jadepalace.com",     role: "MANAGER",  status: "ACTIVE",     joined: "Jan 28, 2026" },
  { id: "usr-07", email: "emma.chen@jadepalace.com",      role: "SALES",    status: "TERMINATED", joined: "Oct 05, 2025" },
];

function roleBadge(role: string) {
  switch (role) {
    case "ADMIN":    return "bg-red-100 text-red-700";
    case "MANAGER":  return "bg-amber-100 text-amber-700";
    case "SALES":    return "bg-emerald-100 text-emerald-700";
    case "CUSTOMER": return "bg-blue-100 text-blue-700";
    default:         return "bg-gray-100 text-gray-600";
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":     return "bg-green-100 text-green-700";
    case "RESTRICTED": return "bg-yellow-100 text-yellow-700";
    case "BANNED":     return "bg-red-100 text-red-600";
    case "SUSPENDED":  return "bg-orange-100 text-orange-600";
    case "TERMINATED": return "bg-gray-200 text-gray-500";
    default:           return "bg-gray-100 text-gray-600";
  }
}

export default function AdminUsers() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="View and update user statuses across all roles."
      />

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">PATCH /admin/users/:userId/status</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["All", "ADMIN", "MANAGER", "SALES", "CUSTOMER"].map((f) => (
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
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-900 font-medium">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(u.status)}`}>{u.status}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{u.joined}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-gray-400 hover:text-gray-600 text-xs font-medium">Change Status</button>
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

