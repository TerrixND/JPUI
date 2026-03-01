"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole, Role } from "./RoleContext";

interface NavItem {
  label: string;
  pathSuffix: string;
  icon: string;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", pathSuffix: "", icon: "grid" },
  { label: "Products", pathSuffix: "products", icon: "box" },
  { label: "Users", pathSuffix: "users", icon: "users" },
  { label: "Branch Network", pathSuffix: "branches", icon: "building" },
  { label: "Inventory", pathSuffix: "inventory", icon: "clipboard" },
  { label: "Staff Rules", pathSuffix: "staff-rules", icon: "shield" },
  { label: "Errors", pathSuffix: "errors", icon: "file" },
  { label: "Logs & Backups", pathSuffix: "logs", icon: "file" },
  { label: "Log History", pathSuffix: "log-history", icon: "history" },
];

const managerNav: NavItem[] = [
  { label: "Dashboard", pathSuffix: "", icon: "grid" },
  { label: "Appointments", pathSuffix: "appointments", icon: "calendar" },
  { label: "Sales Team", pathSuffix: "salespersons", icon: "users" },
  { label: "Inventory", pathSuffix: "inventory", icon: "clipboard" },
  { label: "Commissions", pathSuffix: "commissions", icon: "dollar" },
  { label: "Products & Targeting", pathSuffix: "targeting", icon: "target" },
  { label: "Staff Rules", pathSuffix: "staff-rules", icon: "shield" },
];

const salespersonNav: NavItem[] = [
  { label: "Dashboard", pathSuffix: "", icon: "grid" },
  { label: "Appointments", pathSuffix: "appointments", icon: "calendar" },
  { label: "Possessions", pathSuffix: "possessions", icon: "box" },
  { label: "Performance", pathSuffix: "performance", icon: "chart" },
];

const navByRole: Record<Role, NavItem[]> = {
  admin: adminNav,
  manager: managerNav,
  salesperson: salespersonNav,
};

const roleLabels: Record<Role, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-600" },
  manager: { label: "Manager", color: "bg-amber-600" },
  salesperson: { label: "Salesperson", color: "bg-emerald-600" },
};

const normalizePath = (value: string) => {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }

  return value;
};

const buildHref = (dashboardBasePath: string, pathSuffix: string) => {
  if (!pathSuffix) {
    return dashboardBasePath;
  }

  return `${dashboardBasePath}/${pathSuffix}`;
};

function NavIcon({ icon }: { icon: string }) {
  const cls = "w-5 h-5";
  switch (icon) {
    case "grid":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          />
        </svg>
      );
    case "box":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      );
    case "clipboard":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      );
    case "chart":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      );
    case "gear":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    case "building":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      );
    case "shield":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case "file":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case "history":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12a9 9 0 109-9 9 9 0 00-6.364 2.636L3 8m0-5v5h5m4 0v5l3 2"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case "dollar":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "target":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
          <circle cx="12" cy="12" r="6" strokeWidth={2} />
          <circle cx="12" cy="12" r="2" strokeWidth={2} />
        </svg>
      );
    default:
      return null;
  }
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { role, isMainAdmin, dashboardBasePath } = useRole();
  const baseRoleMeta = roleLabels[role];
  const roleMeta =
    role === "admin" && isMainAdmin
      ? { ...baseRoleMeta, label: "Main Admin" }
      : baseRoleMeta;
  const normalizedPathname = normalizePath(pathname);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-64
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-700/60
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700/60 shrink-0">
          <Link
            href={dashboardBasePath}
            className="flex items-center gap-2 group"
          >
            <svg className="w-6 h-6 text-emerald-600 shrink-0" viewBox="0 0 32 32" fill="none">
              <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
              <polygon points="16,8 24,12.5 24,21.5 16,26 8,21.5 8,12.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
              <circle cx="16" cy="16" r="3" fill="currentColor" />
            </svg>
            <span className="text-lg font-bold text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              Jade<span className="text-emerald-600">Palace</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Role badge */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500">
            Signed in as
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${roleMeta.color}`}
            />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{roleMeta.label}</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-3 space-y-0.5 overflow-y-auto">
          {navByRole[role].map((item) => {
            const href = buildHref(dashboardBasePath, item.pathSuffix);
            const normalizedHref = normalizePath(href);
            const isActive =
              item.pathSuffix === ""
                ? normalizedPathname === normalizedHref
                : normalizedPathname === normalizedHref ||
                  normalizedPathname.startsWith(`${normalizedHref}/`);

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                  }
                `}
              >
                <span className={isActive ? "text-emerald-600 dark:text-emerald-400" : ""}>
                  <NavIcon icon={item.icon} />
                </span>
                {item.label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer user info */}
        <div className="border-t border-gray-200 dark:border-gray-700/60 p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full ${roleMeta.color} flex items-center justify-center text-white text-sm font-semibold ring-2 ring-white dark:ring-gray-800`}
            >
              {roleMeta.label[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {roleMeta.label} User
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {role}@jadepalace.com
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
