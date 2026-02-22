import PageHeader from "@/components/ui/dashboard/PageHeader";

const rules = [
  { id: "rule-01", role: "SALES",   branch: "Downtown HQ",     description: "Auto-assign to Downtown branch on onboarding", status: "ACTIVE",  createdAt: "Jan 10, 2026" },
  { id: "rule-02", role: "SALES",   branch: "Westside Branch",  description: "Require manager approval for Westside",         status: "ACTIVE",  createdAt: "Jan 15, 2026" },
  { id: "rule-03", role: "MANAGER", branch: "North Point",      description: "Grant analytics access on onboarding",          status: "ACTIVE",  createdAt: "Feb 01, 2026" },
  { id: "rule-04", role: "SALES",   branch: "East Village",     description: "Limit initial product possession to 10 items",  status: "REVOKED", createdAt: "Dec 05, 2025" },
  { id: "rule-05", role: "MANAGER", branch: "All Branches",     description: "Default commission policy assignment",           status: "ACTIVE",  createdAt: "Feb 12, 2026" },
];

export default function AdminStaffRules() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Onboarding Rules"
        description="Manage rules that are automatically applied when new staff members are onboarded."
        action={
          <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
            + New Rule
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {["POST /admin/staff-onboarding/rules", "GET /admin/staff-onboarding/rules", "PATCH /admin/staff-onboarding/rules/:ruleId/revoke"].map((ep) => (
          <span key={ep} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">{ep}</span>
        ))}
      </div>

      {/* Rules cards */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                  rule.role === "SALES" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {rule.role}
                </span>
                <span className="text-xs text-gray-400">{rule.branch}</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  rule.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                }`}>
                  {rule.status}
                </span>
              </div>
              <p className="text-sm text-gray-800">{rule.description}</p>
              <p className="text-xs text-gray-400 mt-1">Created {rule.createdAt} &middot; {rule.id}</p>
            </div>
            {rule.status === "ACTIVE" && (
              <button className="shrink-0 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

