"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/dashboard/Sidebar";
import Navbar from "@/components/ui/dashboard/Navbar";
import { RoleProvider, type Role } from "@/components/ui/dashboard/RoleContext";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import {
  checkDashboardRouteAccess,
  mapBackendRoleToDashboardRole,
} from "@/lib/roleChecker";

type MeResponse = {
  id: string | null;
  role: string | null;
  status: string | null;
  isSetup: boolean;
};

type DashboardAuthState = {
  loading: boolean;
  role: Role | null;
  userId: string | null;
  error: string;
};

const initialAuthState: DashboardAuthState = {
  loading: true,
  role: null,
  userId: null,
  error: "",
};

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unable to verify dashboard access.";
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

  const loadDashboardAccess = useCallback(
    async (accessTokenFromSession?: string) => {
      setAuthState((current) => ({ ...current, loading: true, error: "" }));

      try {
        if (!isSupabaseConfigured) {
          throw new Error(
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
          );
        }

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

        if (!accessToken) {
          setAuthState(initialAuthState);
          router.replace("/404");
          return;
        }

        const meResponse = await fetch("/api/v1/user/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        const meBody = (await meResponse.json().catch(() => null)) as
          | (MeResponse & { message?: string })
          | null;

        if (!meResponse.ok) {
          const message =
            meBody?.message || "Unable to verify user role for dashboard access.";

          if (meResponse.status === 401) {
            await supabase.auth.signOut().catch(() => undefined);
            setAuthState(initialAuthState);
            router.replace("/404");
            return;
          }

          throw new Error(message);
        }

        const dashboardRole = mapBackendRoleToDashboardRole(meBody?.role);
        const userId = meBody?.id || "";
        const isActive = meBody?.status === "ACTIVE";
        const isSetup = Boolean(meBody?.isSetup);

        if (!dashboardRole || !userId || !isActive || !isSetup) {
          setAuthState(initialAuthState);
          router.replace("/404");
          return;
        }

        setAuthState({
          loading: false,
          role: dashboardRole,
          userId,
          error: "",
        });
      } catch (error) {
        setAuthState({
          loading: false,
          role: null,
          userId: null,
          error: getErrorMessage(error),
        });
      }
    },
    [router],
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
    <RoleProvider role={authState.role} userId={authState.userId}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
