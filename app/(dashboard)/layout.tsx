"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/dashboard/Sidebar";
import Navbar from "@/components/ui/dashboard/Navbar";
import { RoleProvider, type Role } from "@/components/ui/dashboard/RoleContext";
import { ThemeProvider } from "@/components/ui/dashboard/ThemeContext";
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
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/20 flex items-center justify-center px-6">
        <div className="jp-fade-in-up flex flex-col items-center gap-8">
          {/* Branding */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-full bg-emerald-400/10 animate-pulse" />
            <div className="relative flex items-center gap-1">
              <svg className="w-8 h-8 text-emerald-600" viewBox="0 0 32 32" fill="none">
                <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
                <polygon points="16,8 24,12.5 24,21.5 16,26 8,21.5 8,12.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
                <circle cx="16" cy="16" r="3" fill="currentColor" />
              </svg>
              <span className="text-2xl font-bold tracking-tight text-gray-800">
                Jade<span className="text-emerald-600">Palace</span>
              </span>
            </div>
          </div>

          {/* Multi-ring spinner */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Outer static ring */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            {/* Primary spinning ring */}
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            {/* Inner counter-spin ring */}
            <div className="absolute inset-2.5 rounded-full border-2 border-emerald-400/50 border-b-transparent jp-spin-reverse" />
            {/* Center dot */}
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Animated dots + message */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 jp-dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 jp-dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 jp-dot-3" />
            </div>
            <p className="text-sm font-medium text-gray-500 tracking-wide">
              {authState.error || "Checking dashboard access…"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ThemeProvider>
      <RoleProvider
        role={authState.role}
        userId={authState.userId}
        isMainAdmin={authState.isMainAdmin}
        adminCapabilities={adminCapabilities}
        refreshAdminCapabilities={refreshAdminCapabilities}
      >
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden transition-colors duration-200">
          {adminRestrictionNotice && (
            <div className="fixed top-4 right-4 z-50 max-w-sm rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 shadow-md">
              <p className="text-sm text-amber-800 dark:text-amber-200">{adminRestrictionNotice}</p>
              <button
                type="button"
                onClick={() => setAdminRestrictionNotice("")}
                className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
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
    </ThemeProvider>
  );
}
