import PageHeader from "@/components/ui/dashboard/PageHeader";
import StatCard from "@/components/ui/dashboard/StatCard";

const performanceStats = [
  {
    label: "Total Sales",
    value: "$31,200",
    change: "+12.8%",
    up: true,
    accent: "bg-emerald-50 text-emerald-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Appointments Completed",
    value: "18",
    change: "+4 this month",
    up: true,
    accent: "bg-blue-50 text-blue-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Commission Rate",
    value: "8%",
    accent: "bg-purple-50 text-purple-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "Commission Earned",
    value: "$2,496",
    change: "+$310",
    up: true,
    accent: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

const monthlySales = [
  { month: "Sep 2025", sales: "$4,200",  appointments: 8,  commission: "$336" },
  { month: "Oct 2025", sales: "$5,100",  appointments: 10, commission: "$408" },
  { month: "Nov 2025", sales: "$3,800",  appointments: 7,  commission: "$304" },
  { month: "Dec 2025", sales: "$6,200",  appointments: 12, commission: "$496" },
  { month: "Jan 2026", sales: "$5,700",  appointments: 11, commission: "$456" },
  { month: "Feb 2026", sales: "$6,200",  appointments: 13, commission: "$496" },
];

const topProducts = [
  { name: "Widget Pro Max", unitsSold: 8, revenue: "$1,999.92" },
  { name: "Widget Pro",     unitsSold: 12, revenue: "$1,559.88" },
  { name: "Gadget X",       unitsSold: 15, revenue: "$749.85" },
  { name: "Turbo Charger",  unitsSold: 6, revenue: "$209.94" },
  { name: "Flex Cable",     unitsSold: 20, revenue: "$250.00" },
];

export default function SalespersonPerformance() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Performance"
        description="Detailed breakdown of your sales performance and commissions."
      />

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">GET /salesperson/me/performance</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Monthly Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Month</th>
                  <th className="px-5 py-3 font-medium">Sales</th>
                  <th className="px-5 py-3 font-medium">Appointments</th>
                  <th className="px-5 py-3 font-medium">Commission</th>
                  <th className="px-5 py-3 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {monthlySales.map((m, i) => {
                  const prev = i > 0 ? parseFloat(monthlySales[i - 1].sales.replace(/[$,]/g, "")) : 0;
                  const curr = parseFloat(m.sales.replace(/[$,]/g, ""));
                  const up = i === 0 || curr >= prev;
                  return (
                    <tr key={m.month} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{m.month}</td>
                      <td className="px-5 py-3 text-gray-700">{m.sales}</td>
                      <td className="px-5 py-3 text-gray-600">{m.appointments}</td>
                      <td className="px-5 py-3 text-gray-600">{m.commission}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${up ? "text-green-600" : "text-red-500"}`}>
                          {up ? "↑" : "↓"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Top Products Sold</h2>
          </div>
          <div className="p-5 space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.unitsSold} units</p>
                </div>
                <span className="text-sm font-semibold text-gray-700">{p.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

