import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  up?: boolean;
  icon: React.ReactNode;
  accent?: string;
  href?: string;
}

export default function StatCard({
  label,
  value,
  change,
  up,
  icon,
  accent = "bg-blue-50 text-blue-600",
  href,
}: StatCardProps) {
  const content = (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 flex items-start gap-4 transition-all duration-150 hover:shadow-md dark:hover:shadow-black/20 group">
      <div className={`shrink-0 p-2.5 rounded-lg ${accent}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
        {change && (
          <span
            className={`text-xs font-medium ${
              up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {href && (
        <svg
          className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
