"use client";

import { buildAuthRouteWithReturnTo, resolveSafeReturnTo } from "@/lib/authRedirect";
import { startLineOAuth } from "@/lib/lineAuth";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LineConnectOptionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo")) || "/";
  const loginHref = buildAuthRouteWithReturnTo(
    "/login",
    `/line/connect-option?returnTo=${encodeURIComponent(returnTo)}`,
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      try {
        if (!isSupabaseConfigured) {
          throw new Error(
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
          );
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        if (!session?.access_token) {
          router.replace(loginHref);
          return;
        }
      } catch (caughtError) {
        if (!isActive) {
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to initialize LINE connect step.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [loginHref, router]);

  const handleSkip = () => {
    router.replace(returnTo);
  };

  const handleConnectLine = async () => {
    setError("");
    setIsConnecting(true);

    try {
      await startLineOAuth({
        intent: "connect",
        returnTo,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to continue with LINE.",
      );
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white px-6 py-20">
        <p className="text-sm text-gray-600">Preparing account setup...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 py-20">
      <div className="mx-auto w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">
          Connect LINE for Future Login
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Your account is ready. You can connect LINE now for quick login in the
          future, or skip and continue.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleConnectLine}
            disabled={isConnecting}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? "Redirecting to LINE..." : "Connect with LINE"}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Skip for now
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}

export default function LineConnectOptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <LineConnectOptionPageContent />
    </Suspense>
  );
}
