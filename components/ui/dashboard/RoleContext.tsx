"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";
import { getDashboardBasePath, type DashboardRole } from "@/lib/roleChecker";
import {
  createEmptyAdminCapabilityState,
  type AdminActionBlock,
  type AdminCapabilityState,
} from "@/lib/adminAccessControl";

export type Role = DashboardRole;

interface RoleContextType {
  role: Role;
  userId: string;
  isMainAdmin: boolean;
  dashboardBasePath: string;
  adminCapabilities: AdminCapabilityState;
  isAdminActionBlocked: (action: AdminActionBlock) => boolean;
  refreshAdminCapabilities: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);
const defaultAdminCapabilities = createEmptyAdminCapabilityState();
const noopRefreshAdminCapabilities = async () => {};

export function RoleProvider({
  children,
  role,
  userId,
  isMainAdmin,
  adminCapabilities,
  refreshAdminCapabilities,
}: {
  children: ReactNode;
  role: Role;
  userId: string;
  isMainAdmin: boolean;
  adminCapabilities?: AdminCapabilityState;
  refreshAdminCapabilities?: () => Promise<void>;
}) {
  const normalizedAdminCapabilities = adminCapabilities ?? defaultAdminCapabilities;

  const value = useMemo(
    () => ({
      role,
      userId,
      isMainAdmin,
      dashboardBasePath: getDashboardBasePath(role, userId),
      adminCapabilities: normalizedAdminCapabilities,
      isAdminActionBlocked: (action: AdminActionBlock) =>
        normalizedAdminCapabilities.blockedActions.has(action),
      refreshAdminCapabilities:
        refreshAdminCapabilities ?? noopRefreshAdminCapabilities,
    }),
    [
      isMainAdmin,
      normalizedAdminCapabilities,
      refreshAdminCapabilities,
      role,
      userId,
    ],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
