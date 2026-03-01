"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  isAccountAccessDeniedError,
  type AccountAccessState,
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
  accountAccess: AccountAccessState | null;
  error: string;
};

const initialAuthState: DashboardAuthState = {
  loading: true,
  role: null,
  userId: null,
  status: null,
  isMainAdmin: false,
  accountAccess: null,
  error: "",
};

const ACCOUNT_ACCESS_CODES = new Set([
  "ACCOUNT_BANNED",
  "ACCOUNT_RESTRICTED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_TERMINATED",
]);
const ADMIN_ACTION_RESTRICTED_CODE = "ADMIN_ACTION_RESTRICTED";

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unable to verify dashboard access.";
};

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

const normalizeAccountAccess = (value: unknown): AccountAccessState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const remainingRaw =
    typeof row.remainingMs === "number"
      ? row.remainingMs
      : typeof row.remainingMs === "string"
        ? Number(row.remainingMs)
        : null;

  return {
    code: typeof row.code === "string" ? row.code : null,
    blockedScope: typeof row.blockedScope === "string" ? row.blockedScope : null,
    canAuthenticate:
      typeof row.canAuthenticate === "boolean" ? row.canAuthenticate : null,
    canAccessRoleRoutes:
      typeof row.canAccessRoleRoutes === "boolean" ? row.canAccessRoleRoutes : null,
    remainingMs:
      typeof remainingRaw === "number" && Number.isFinite(remainingRaw) && remainingRaw >= 0
        ? Math.floor(remainingRaw)
        : null,
    raw: row,
  };
};

const formatRemainingTime = (remainingMs: number | null) => {
  if (remainingMs === null || remainingMs <= 0) {
    return "Until access is restored";
  }

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s remaining`;
  }

  return `${seconds}s remaining`;
};

const getAccessTitle = (accountAccess: AccountAccessState | null) => {
  switch (accountAccess?.code) {
    case "ACCOUNT_BANNED":
      return "Dashboard access is banned";
    case "ACCOUNT_SUSPENDED":
      return "Dashboard access is suspended";
    case "ACCOUNT_TERMINATED":
      return "Dashboard access is terminated";
    default:
      return "Dashboard access is restricted";
  }
};

const getAccessDescription = (accountAccess: AccountAccessState | null) => {
  switch (accountAccess?.code) {
    case "ACCOUNT_BANNED":
      return "A main admin has banned this account from role-based routes.";
    case "ACCOUNT_SUSPENDED":
      return "This account is suspended and cannot continue into protected role-based routes.";
    case "ACCOUNT_TERMINATED":
      return "This account has been terminated and cannot open role-based routes.";
    default:
      return "This account can still authenticate, but role-based routes are temporarily blocked.";
  }
};

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/20 flex items-center justify-center px-6">
      <div className="jp-fade-in-up flex flex-col items-center gap-8">
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

        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          <div className="absolute inset-2.5 rounded-full border-2 border-emerald-400/50 border-b-transparent jp-spin-reverse" />
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 jp-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 jp-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 jp-dot-3" />
          </div>
          <p className="text-sm font-medium text-gray-500 tracking-wide">{message}</p>
        </div>
      </div>
    </main>
  );
}

function AccessRestrictedScreen({
  accountAccess,
  onRefresh,
  onSignOut,
}: {
  accountAccess: AccountAccessState | null;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50/40 px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-3xl border border-amber-200 bg-white/95 shadow-xl shadow-amber-100/60 backdrop-blur">
        <div className="border-b border-amber-100 px-8 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Role Route Access
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900">
            {getAccessTitle(accountAccess)}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-600">
            {getAccessDescription(accountAccess)}
          </p>
        </div>

        <div className="grid gap-4 px-8 py-7 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Status Code
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {accountAccess?.code || "ACCOUNT_RESTRICTED"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Block Scope
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {accountAccess?.blockedScope || "ROLE_ROUTES"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Access Window
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {formatRemainingTime(accountAccess?.remainingMs ?? null)}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 py-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Refresh Access
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
}

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
  const hasResolvedInitialAccessRef = useRef(false);
  const lastResolvedAccessTokenRef = useRef("");
  const latestAccessRequestIdRef = useRef(0);
  const accessLoadRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);

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
    }): Promise<AdminCapabilityState> => {
      if (role !== "admin" || !userId) {
        return createEmptyAdminCapabilityState();
      }

      try {
        const detail = await getAdminUserDetail({
          accessToken,
          userId,
        });

        return buildAdminCapabilityState(detail.activeAccessControls);
      } catch {
        return createEmptyAdminCapabilityState();
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

      const nextCapabilities = await loadAdminCapabilities({
        accessToken,
        role: authState.role,
        userId: authState.userId,
      });

      setAdminCapabilities(nextCapabilities);
    } catch {
      setAdminCapabilities(createEmptyAdminCapabilityState());
    }
  }, [authState.role, authState.userId, loadAdminCapabilities, resolveAccessToken]);

  const loadDashboardAccess = useCallback(
    async ({
      accessTokenFromSession,
      forceBlocking = false,
    }: {
      accessTokenFromSession?: string;
      forceBlocking?: boolean;
    } = {}) => {
      const loadKey = accessTokenFromSession || "__SESSION__";
      if (accessLoadRef.current?.key === loadKey) {
        return accessLoadRef.current.promise;
      }

      const requestId = ++latestAccessRequestIdRef.current;
      const shouldBlock = forceBlocking || !hasResolvedInitialAccessRef.current;

      const task = (async () => {
        if (shouldBlock) {
          setAuthState((current) => ({ ...current, loading: true, error: "" }));
        } else {
          setAuthState((current) => ({ ...current, error: "" }));
        }

        try {
          if (!isSupabaseConfigured) {
            throw new Error(
              "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
            );
          }

          const accessToken = await resolveAccessToken(accessTokenFromSession);

          if (requestId !== latestAccessRequestIdRef.current) {
            return;
          }

          if (!accessToken) {
            lastResolvedAccessTokenRef.current = "";
            hasResolvedInitialAccessRef.current = true;
            setAuthState(initialAuthState);
            setAdminCapabilities(createEmptyAdminCapabilityState());
            router.replace("/404");
            return;
          }

          const me = await getUserMe({
            accessToken,
          });

          if (requestId !== latestAccessRequestIdRef.current) {
            return;
          }

          const dashboardRole = mapBackendRoleToDashboardRole(me.role);
          const userId = me.id || "";
          const isSetup = me.isSetup;

          if (!dashboardRole || !userId || !isSetup) {
            lastResolvedAccessTokenRef.current = "";
            hasResolvedInitialAccessRef.current = true;
            setAuthState(initialAuthState);
            setAdminCapabilities(createEmptyAdminCapabilityState());
            router.replace("/404");
            return;
          }

          const nextAdminCapabilities =
            me.accountAccess?.canAccessRoleRoutes !== false
              ? await loadAdminCapabilities({
                  accessToken,
                  role: dashboardRole,
                  userId,
                })
              : createEmptyAdminCapabilityState();

          if (requestId !== latestAccessRequestIdRef.current) {
            return;
          }

          lastResolvedAccessTokenRef.current = accessToken;
          hasResolvedInitialAccessRef.current = true;
          setAdminCapabilities(nextAdminCapabilities);
          setAuthState({
            loading: false,
            role: dashboardRole,
            userId,
            status: me.status || null,
            isMainAdmin: me.isMainAdmin,
            accountAccess: me.accountAccess,
            error: "",
          });
        } catch (error) {
          if (requestId !== latestAccessRequestIdRef.current) {
            return;
          }

          hasResolvedInitialAccessRef.current = true;

          if (
            isAccountAccessDeniedError(error) &&
            error.code !== "ACCOUNT_RESTRICTED"
          ) {
            await forceLogoutToBlockedPage(
              error.payload ?? {
                message: error.message,
                code: error.code,
              },
            );
            return;
          }

          if (error instanceof ApiClientError && error.status === 401) {
            lastResolvedAccessTokenRef.current = "";
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
            accountAccess: null,
            error: getErrorMessage(error),
          });
          setAdminCapabilities(createEmptyAdminCapabilityState());
        }
      })();

      const wrappedTask = task.finally(() => {
        if (accessLoadRef.current?.promise === wrappedTask) {
          accessLoadRef.current = null;
        }
      });

      accessLoadRef.current = {
        key: loadKey,
        promise: wrappedTask,
      };

      return accessLoadRef.current.promise;
    },
    [loadAdminCapabilities, resolveAccessToken, router],
  );

  useEffect(() => {
    void loadDashboardAccess({
      forceBlocking: true,
    });
  }, [loadDashboardAccess]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        return;
      }

      const accessToken = session?.access_token;

      if (!accessToken) {
        lastResolvedAccessTokenRef.current = "";
        hasResolvedInitialAccessRef.current = true;
        setAuthState(initialAuthState);
        setAdminCapabilities(createEmptyAdminCapabilityState());
        router.replace("/404");
        return;
      }

      if (accessToken === lastResolvedAccessTokenRef.current) {
        return;
      }

      void loadDashboardAccess({
        accessTokenFromSession: accessToken,
      });
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
            | { code?: unknown; message?: unknown; details?: unknown }
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

          if (ACCOUNT_ACCESS_CODES.has(code)) {
            const nextAccountAccess =
              normalizeAccountAccess(payload?.details) ??
              normalizeAccountAccess({ code });

            setAuthState((current) => ({
              ...current,
              loading: false,
              accountAccess: nextAccountAccess,
              error: "",
            }));
            setAdminCapabilities(createEmptyAdminCapabilityState());
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
    const remainingMs = authState.accountAccess?.remainingMs;
    if (
      authState.accountAccess?.canAccessRoleRoutes !== false ||
      remainingMs == null ||
      remainingMs <= 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAuthState((current) => ({
        ...current,
        accountAccess: current.accountAccess
          ? {
              ...current.accountAccess,
              remainingMs: Math.max(0, (current.accountAccess.remainingMs || 0) - 1000),
            }
          : current.accountAccess,
      }));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authState.accountAccess]);

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
    return <LoadingScreen message={authState.error || "Checking dashboard access…"} />;
  }

  if (authState.accountAccess?.canAccessRoleRoutes === false) {
    return (
      <AccessRestrictedScreen
        accountAccess={authState.accountAccess}
        onRefresh={() => {
          void loadDashboardAccess();
        }}
        onSignOut={() => {
          void forceLogoutToBlockedPage();
        }}
      />
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
