interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  up?: boolean;
  icon: React.ReactNode;
  accent?: string;          // tailwind bg color for icon area
}

export default function StatCard({
  label,
  value,
  change,
  up,
  icon,
  accent = "bg-blue-50 text-blue-600",
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`shrink-0 p-2.5 rounded-lg ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <span
            className={`text-xs font-medium ${
              up ? "text-green-600" : "text-red-500"
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
