"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";
import { getDashboardBasePath, type DashboardRole } from "@/lib/roleChecker";

export type Role = DashboardRole;

interface RoleContextType {
  role: Role;
  userId: string;
  dashboardBasePath: string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({
  children,
  role,
  userId,
}: {
  children: ReactNode;
  role: Role;
  userId: string;
}) {
  const value = useMemo(
    () => ({
      role,
      userId,
      dashboardBasePath: getDashboardBasePath(role, userId),
    }),
    [role, userId],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
