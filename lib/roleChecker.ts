export type DashboardRole = "admin" | "manager" | "salesperson";

export type BackendRole = string | null | undefined;

const backendToDashboardRole: Record<string, DashboardRole> = {
  ADMIN: "admin",
  MANAGER: "manager",
  SALES: "salesperson",
};

const sanitizeRole = (role: BackendRole) => {
  if (!role) {
    return "";
  }

  return role.trim().toUpperCase();
};

export const mapBackendRoleToDashboardRole = (
  role: BackendRole,
): DashboardRole | null => {
  const sanitizedRole = sanitizeRole(role);
  return backendToDashboardRole[sanitizedRole] || null;
};

export const getDashboardBasePath = (role: DashboardRole, userId: string) => {
  return `/${role}/dashboard/${userId}`;
};

export type DashboardAccessResult = {
  allowed: boolean;
  redirectTo: string;
  reason?: "invalid-path" | "invalid-role" | "invalid-user";
};

export const checkDashboardRouteAccess = (
  pathname: string,
  role: DashboardRole,
  userId: string,
): DashboardAccessResult => {
  const canonicalPath = getDashboardBasePath(role, userId);
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 3) {
    return {
      allowed: false,
      redirectTo: canonicalPath,
      reason: "invalid-path",
    };
  }

  const [pathRole, dashboardSegment, pathUserId] = segments;

  if (dashboardSegment !== "dashboard") {
    return {
      allowed: false,
      redirectTo: canonicalPath,
      reason: "invalid-path",
    };
  }

  if (pathRole !== role) {
    return {
      allowed: false,
      redirectTo: canonicalPath,
      reason: "invalid-role",
    };
  }

  if (pathUserId !== userId) {
    return {
      allowed: false,
      redirectTo: canonicalPath,
      reason: "invalid-user",
    };
  }

  return {
    allowed: true,
    redirectTo: canonicalPath,
  };
};
