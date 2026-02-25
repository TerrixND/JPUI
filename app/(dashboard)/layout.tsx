"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/dashboard/Sidebar";
import Navbar from "@/components/ui/dashboard/Navbar";
import { RoleProvider, type Role } from "@/components/ui/dashboard/RoleContext";
import {
  ApiClientError,
  forceLogoutToBlockedPage,
  getAdminUserDetail,
  getUserMe,
  handleAccountAccessDeniedError,
} from "@/lib/apiClient";
import {
  buildAdminCapabilityState,
  createEmptyAdminCapabilityState,
  type AdminCapabilityState,
} from "@/lib/adminAccessControl";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import {
  checkDashboardRouteAccess,
  mapBackendRoleToDashboardRole,
} from "@/lib/roleChecker";

type DashboardAuthState = {
  loading: boolean;
  role: Role | null;
  userId: string | null;
  status: string | null;
  isMainAdmin: boolean;
  error: string;
};

const initialAuthState: DashboardAuthState = {
  loading: true,
  role: null,
  userId: null,
  status: null,
  isMainAdmin: false,
  error: "",
};

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unable to verify dashboard access.";
};

const ADMIN_ACTION_RESTRICTED_CODE = "ADMIN_ACTION_RESTRICTED";

const getRequestMethod = (args: Parameters<typeof fetch>) => {
  const optionsMethod = typeof args[1]?.method === "string" ? args[1].method : "";
  if (optionsMethod) {
    return optionsMethod.toUpperCase();
  }

  const request = args[0];
  if (typeof Request !== "undefined" && request instanceof Request) {
    return request.method.toUpperCase();
  }

  return "GET";
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authState, setAuthState] = useState<DashboardAuthState>(initialAuthState);
  const [adminCapabilities, setAdminCapabilities] = useState<AdminCapabilityState>(() =>
    createEmptyAdminCapabilityState(),
  );
  const [adminRestrictionNotice, setAdminRestrictionNotice] = useState("");

  const resolveAccessToken = useCallback(async (accessTokenFromSession?: string) => {
    let accessToken = accessTokenFromSession || "";

    if (!accessToken) {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      accessToken = session?.access_token || "";
    }

    return accessToken;
  }, []);

  const loadAdminCapabilities = useCallback(
    async ({
      accessToken,
      role,
      userId,
    }: {
      accessToken: string;
      role: Role;
      userId: string;
    }) => {
      if (role !== "admin" || !userId) {
        setAdminCapabilities(createEmptyAdminCapabilityState());
        return;
      }

      try {
        const detail = await getAdminUserDetail({
          accessToken,
          userId,
        });

        setAdminCapabilities(buildAdminCapabilityState(detail.activeAccessControls));
      } catch (error) {
        if (handleAccountAccessDeniedError(error)) {
          return;
        }

        setAdminCapabilities(createEmptyAdminCapabilityState());
      }
    },
    [],
  );

  const refreshAdminCapabilities = useCallback(async () => {
    if (authState.role !== "admin" || !authState.userId) {
      setAdminCapabilities(createEmptyAdminCapabilityState());
      return;
    }

    try {
      const accessToken = await resolveAccessToken();
      if (!accessToken) {
        setAdminCapabilities(createEmptyAdminCapabilityState());
        return;
      }

      await loadAdminCapabilities({
        accessToken,
        role: authState.role,
        userId: authState.userId,
      });
    } catch (error) {
      if (handleAccountAccessDeniedError(error)) {
        return;
      }

      setAdminCapabilities(createEmptyAdminCapabilityState());
    }
  }, [authState.role, authState.userId, loadAdminCapabilities, resolveAccessToken]);

  const loadDashboardAccess = useCallback(
    async (accessTokenFromSession?: string) => {
      setAuthState((current) => ({ ...current, loading: true, error: "" }));

      try {
        if (!isSupabaseConfigured) {
          throw new Error(
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
          );
        }

        const accessToken = await resolveAccessToken(accessTokenFromSession);

        if (!accessToken) {
          setAuthState(initialAuthState);
          setAdminCapabilities(createEmptyAdminCapabilityState());
          router.replace("/404");
          return;
        }

        const me = await getUserMe({
          accessToken,
        });

        if (me.status === "BANNED" || me.status === "RESTRICTED") {
          await forceLogoutToBlockedPage();
          setAuthState(initialAuthState);
          setAdminCapabilities(createEmptyAdminCapabilityState());
          return;
        }

        const dashboardRole = mapBackendRoleToDashboardRole(me.role);
        const userId = me.id || "";
        const isActive = me.status === "ACTIVE";
        const isSetup = me.isSetup;

        if (!dashboardRole || !userId || !isActive || !isSetup) {
          setAuthState(initialAuthState);
          setAdminCapabilities(createEmptyAdminCapabilityState());
          router.replace("/404");
          return;
        }

        await loadAdminCapabilities({
          accessToken,
          role: dashboardRole,
          userId,
        });

        setAuthState({
          loading: false,
          role: dashboardRole,
          userId,
          status: me.status || null,
          isMainAdmin: me.isMainAdmin,
          error: "",
        });
      } catch (error) {
        if (handleAccountAccessDeniedError(error)) {
          setAuthState(initialAuthState);
          setAdminCapabilities(createEmptyAdminCapabilityState());
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          setAuthState(initialAuthState);
          setAdminCapabilities(createEmptyAdminCapabilityState());
          router.replace("/404");
          return;
        }

        setAuthState({
          loading: false,
          role: null,
          userId: null,
          status: null,
          isMainAdmin: false,
          error: getErrorMessage(error),
        });
        setAdminCapabilities(createEmptyAdminCapabilityState());
      }
    },
    [loadAdminCapabilities, resolveAccessToken, router],
  );

  useEffect(() => {
    void loadDashboardAccess();
  }, [loadDashboardAccess]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token;

      if (!accessToken) {
        setAuthState(initialAuthState);
        setAdminCapabilities(createEmptyAdminCapabilityState());
        router.replace("/404");
        return;
      }

      void loadDashboardAccess(accessToken);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadDashboardAccess, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 403) {
        try {
          const payload = (await response.clone().json().catch(() => null)) as
            | { code?: unknown; message?: unknown }
            | null;
          const code =
            typeof payload?.code === "string"
              ? payload.code.trim().toUpperCase()
              : "";
          const message =
            typeof payload?.message === "string" ? payload.message.trim() : "";
          const requestMethod = getRequestMethod(args);
          const isWriteRequest =
            requestMethod === "POST" ||
            requestMethod === "PATCH" ||
            requestMethod === "PUT" ||
            requestMethod === "DELETE";

          if (code === "ACCOUNT_BANNED" || code === "ACCOUNT_RESTRICTED") {
            void forceLogoutToBlockedPage();
          } else if (code === ADMIN_ACTION_RESTRICTED_CODE && isWriteRequest) {
            setAdminRestrictionNotice(
              message || "This action is currently restricted by an active access control.",
            );

            if (authState.role === "admin" && authState.userId) {
              void refreshAdminCapabilities();
            }
          }
        } catch {
          // Ignore parse failures and keep original response.
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [authState.role, authState.userId, refreshAdminCapabilities]);

  useEffect(() => {
    if (!adminRestrictionNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAdminRestrictionNotice("");
    }, 6000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [adminRestrictionNotice]);

  useEffect(() => {
    if (authState.loading || !authState.role || !authState.userId) {
      return;
    }

    const access = checkDashboardRouteAccess(
      pathname,
      authState.role,
      authState.userId,
    );

    if (!access.allowed) {
      router.replace(access.redirectTo);
    }
  }, [authState.loading, authState.role, authState.userId, pathname, router]);

  if (authState.loading || !authState.role || !authState.userId) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {authState.error || "Checking dashboard access..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <RoleProvider
      role={authState.role}
      userId={authState.userId}
      isMainAdmin={authState.isMainAdmin}
      adminCapabilities={adminCapabilities}
      refreshAdminCapabilities={refreshAdminCapabilities}
    >
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {adminRestrictionNotice && (
          <div className="fixed top-4 right-4 z-50 max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-md">
            <p className="text-sm text-amber-800">{adminRestrictionNotice}</p>
            <button
              type="button"
              onClick={() => setAdminRestrictionNotice("")}
              className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
