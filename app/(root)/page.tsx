"use client";

import AboutProduct from "@/components/ui/AboutProduct";
import Footer from "@/components/ui/Footer";
import ScrollHero from "@/components/ui/ScrollHero";
import NewArrivals from "@/components/ui/NewArrivals";
import OurProcess from "@/components/ui/OurProcess";
import LatestInfo from "@/components/ui/LatestInfo";

import {
  completePendingSetupForSession,
  isAuthBlockedError,
  precheckLogin,
} from "@/lib/setupUser";

import {
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
  redirectToBlockedPage,
} from "@/lib/apiClient";
import { buildAuthRouteWithReturnTo, resolveSafeReturnTo } from "@/lib/authRedirect";
import {
  consumePendingLineAuthContext,
  exchangeLineAuthorizationCode,
  resolveLineIdentityFromSupabaseUser,
} from "@/lib/lineAuth";

import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import { useRouter } from "next/navigation";

import React, { useEffect, useRef, useState } from "react";

const HomePage = () => {
  const [setupError, setSetupError] = useState("");
  const hasSyncedSetupRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (hasSyncedSetupRef.current) return;
    hasSyncedSetupRef.current = true;

    const syncSetupUserAfterCallback = async () => {
      if (!isSupabaseConfigured) return;

      try {
        const callbackSearchParams = new URLSearchParams(window.location.search);
        const isLineAuthCallback = callbackSearchParams.get("lineAuth") === "1";
        const callbackReturnTo =
          resolveSafeReturnTo(callbackSearchParams.get("returnTo")) || "/";
        const hasAuthCode = Boolean(callbackSearchParams.get("code"));
        const lineOauthError = callbackSearchParams.get("error");
        const lineOauthErrorDescription = callbackSearchParams.get(
          "error_description",
        );

        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          if (
            sessionError.message
              .toLowerCase()
              .includes("invalid refresh token")
          ) {
            return;
          }

          throw new Error(sessionError.message);
        }

        let session = initialSession;
        let callbackLineUserId: string | null = null;
        let callbackLineDisplayName: string | null = null;

        if (isLineAuthCallback) {
          if (lineOauthError) {
            throw new Error(
              lineOauthErrorDescription || `LINE authorization failed: ${lineOauthError}`,
            );
          }

          if (hasAuthCode) {
            const pendingLineAuth = consumePendingLineAuthContext(
              callbackSearchParams.get("state"),
            );

            const lineExchangeResult = await exchangeLineAuthorizationCode({
              code: String(callbackSearchParams.get("code") || ""),
              nonce: pendingLineAuth.nonce,
              redirectUri: pendingLineAuth.redirectUri,
            });

            callbackLineUserId = lineExchangeResult.lineIdentity.lineUserId || null;
            callbackLineDisplayName =
              lineExchangeResult.lineIdentity.lineDisplayName || null;

            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: lineExchangeResult.session.accessToken,
              refresh_token: lineExchangeResult.session.refreshToken,
            });
            if (setSessionError) {
              throw new Error(setSessionError.message);
            }

            const {
              data: { session: exchangedSession },
              error: exchangedSessionError,
            } = await supabase.auth.getSession();
            if (exchangedSessionError) {
              throw new Error(exchangedSessionError.message);
            }

            session = exchangedSession;
          }
        }

        if (!session?.access_token) {
          if (isLineAuthCallback) {
            router.replace(buildAuthRouteWithReturnTo("/login", callbackReturnTo));
          }
          return;
        }

        if (isLineAuthCallback) {
          const fallbackLineIdentity = resolveLineIdentityFromSupabaseUser(
            session.user,
          );
          const resolvedLineUserId =
            callbackLineUserId || fallbackLineIdentity.lineUserId;

          if (!resolvedLineUserId) {
            throw new Error(
              "Unable to resolve LINE identity from session. Please continue with LINE again.",
            );
          }

          await precheckLogin({
            lineUserId: resolvedLineUserId,
          });
        }

        const didCompletePendingSetup =
          await completePendingSetupForSession({
            accessToken: session.access_token,
            email: session.user?.email,
          });

        if (didCompletePendingSetup || isLineAuthCallback) {
          let me;

          try {
            me = await getUserMe({
              accessToken: session.access_token,
            });
          } catch (accountError) {
            if (isAccountAccessDeniedError(accountError)) {
              await forceLogoutToBlockedPage(
                accountError.payload ?? {
                  message: accountError.message,
                  code: accountError.code,
                },
              );
              return;
            }

            throw accountError;
          }

          if (isLineAuthCallback) {
            if (!me?.isSetup) {
              const setupRoute = new URL(
                buildAuthRouteWithReturnTo("/signup", callbackReturnTo),
                window.location.origin,
              );
              setupRoute.searchParams.set("lineSetup", "1");
              if (callbackLineUserId) {
                setupRoute.searchParams.set("lineUserId", callbackLineUserId);
              }
              if (callbackLineDisplayName) {
                setupRoute.searchParams.set(
                  "lineDisplayName",
                  callbackLineDisplayName,
                );
              }
              router.replace(`${setupRoute.pathname}${setupRoute.search}`);
              return;
            }

            router.replace(callbackReturnTo);
            return;
          }
        }
      } catch (error) {
        if (isAuthBlockedError(error)) {
          await supabase.auth.signOut().catch(() => undefined);

          redirectToBlockedPage({
            message: error.message,
            code: error.code,
            details: error.details,
          });

          return;
        }

        setSetupError(
          error instanceof Error
            ? error.message
            : "Unable to complete account setup.",
        );
      }
    };

    syncSetupUserAfterCallback();
  }, [router]);

  return (
    <div className="bg-black">
      <main className="scroll-smooth">
        <ScrollHero />

        <AboutProduct />
        <NewArrivals />
        <OurProcess />
        <LatestInfo />
        <Footer />

        {setupError && (
          <p className="mt-3 text-sm text-red-600 text-center">
            Account setup sync failed: {setupError}
          </p>
        )}
      </main>
    </div>
  );
};

export default HomePage;
