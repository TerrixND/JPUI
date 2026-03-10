"use client";

import AboutProduct from "@/components/ui/AboutProduct";
import Footer from "@/components/ui/Footer";
import PageEntranceLoader from "@/components/ui/PageEntranceLoader";
import ScrollHero from "@/components/ui/ScrollHero";
import ScrollRevealSection from "@/components/ui/ScrollRevealSection";
import NewArrivals from "@/components/ui/NewArrivals";
import OurProcess from "@/components/ui/OurProcess";
import LatestInfo from "@/components/ui/LatestInfo";
import { gsap } from "gsap";

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
  updateUserMeProfile,
} from "@/lib/apiClient";
import { buildAuthRouteWithReturnTo, resolveSafeReturnTo } from "@/lib/authRedirect";
import {
  checkLineAccount,
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
  const homeMainRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (hasSyncedSetupRef.current) return;
    hasSyncedSetupRef.current = true;

    const syncSetupUserAfterCallback = async () => {
      if (!isSupabaseConfigured) return;

      const callbackSearchParams = new URLSearchParams(window.location.search);
      const isLineAuthCallback = callbackSearchParams.get("lineAuth") === "1";
      const callbackIntent = callbackSearchParams.get("intent") || "";
      const callbackReturnTo =
        resolveSafeReturnTo(callbackSearchParams.get("returnTo")) || "/";

      try {
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
              intent: pendingLineAuth.intent,
            });

            callbackLineUserId = lineExchangeResult.lineIdentity.lineUserId || null;
            callbackLineDisplayName =
              lineExchangeResult.lineIdentity.lineDisplayName || null;

            if (pendingLineAuth.intent === "connect") {
              if (!session?.access_token) {
                throw new Error("Your session expired. Please login again.");
              }

              if (!callbackLineUserId) {
                throw new Error(
                  "Unable to resolve LINE identity. Please continue with LINE again.",
                );
              }

              await updateUserMeProfile({
                accessToken: session.access_token,
                payload: {
                  lineUserId: callbackLineUserId,
                  lineDisplayName: callbackLineDisplayName,
                  linePictureUrl:
                    lineExchangeResult.lineIdentity.linePictureUrl || null,
                  lineNotificationsEnabled: false,
                },
              });

              const connectedRoute = new URL(
                callbackReturnTo,
                window.location.origin,
              );
              connectedRoute.searchParams.set("lineConnected", "1");
              router.replace(
                `${connectedRoute.pathname}${connectedRoute.search}`,
              );
              return;
            }

            if (pendingLineAuth.intent === "signup") {
              if (!callbackLineUserId) {
                throw new Error(
                  "Unable to resolve LINE identity. Please continue with LINE again.",
                );
              }

              const lineAccountCheck = await checkLineAccount({
                lineUserId: callbackLineUserId,
                lineDisplayName: callbackLineDisplayName,
              });

              if (!lineAccountCheck.eligible) {
                const loginRoute = new URL(
                  buildAuthRouteWithReturnTo("/login", callbackReturnTo),
                  window.location.origin,
                );
                loginRoute.searchParams.set(
                  "lineAuthError",
                  lineAccountCheck.message ||
                    "Line account is already connected with user account. Please login with email and password.",
                );
                router.replace(`${loginRoute.pathname}${loginRoute.search}`);
                return;
              }
            }

            const lineSession = lineExchangeResult.session;
            if (!lineSession?.accessToken || !lineSession?.refreshToken) {
              throw new Error(
                "LINE exchange response does not include a valid session.",
              );
            }

            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: lineSession.accessToken,
              refresh_token: lineSession.refreshToken,
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

        if (isLineAuthCallback && callbackIntent === "connect") {
          const failedRoute = new URL(callbackReturnTo, window.location.origin);
          failedRoute.searchParams.set(
            "lineConnectError",
            error instanceof Error ? error.message : "Unable to connect LINE.",
          );
          router.replace(`${failedRoute.pathname}${failedRoute.search}`);
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

  useEffect(() => {
    const root = homeMainRef.current;

    if (!root) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interactiveElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-home-hover]"),
    );

    const cleanup = interactiveElements.map((element) => {
      const preset = element.dataset.homeHover || "link";
      const computedStyle = window.getComputedStyle(element);
      const baseBoxShadow =
        computedStyle.boxShadow && computedStyle.boxShadow !== "none"
          ? computedStyle.boxShadow
          : "0 0 0 rgba(0,0,0,0)";
      const xTo = gsap.quickTo(element, "x", {
        duration: 0.35,
        ease: "power3.out",
      });
      const yTo = gsap.quickTo(element, "y", {
        duration: 0.35,
        ease: "power3.out",
      });

      gsap.set(element, {
        transformOrigin: "center center",
        willChange: "transform, box-shadow",
      });

      const resolveConfig = () => {
        switch (preset) {
          case "hero-cta":
            return {
              scale: 1.045,
              lift: -6,
              shadow: "0 18px 45px rgba(200, 169, 110, 0.28)",
              magnetic: 14,
            };
          case "hero-control":
            return {
              scale: 1.08,
              lift: -4,
              shadow: "0 14px 32px rgba(0, 0, 0, 0.28)",
              magnetic: 9,
            };
          case "hero-progress":
            return {
              scale: 1,
              lift: 0,
              shadow: baseBoxShadow,
              magnetic: 0,
            };
          case "button":
            return {
              scale: 1.035,
              lift: -4,
              shadow: "0 14px 28px rgba(17, 24, 39, 0.16)",
              magnetic: 6,
            };
          case "card":
            return {
              scale: 1.018,
              lift: -6,
              shadow: "0 20px 38px rgba(17, 24, 39, 0.1)",
              magnetic: 10,
            };
          case "footer-link":
            return {
              scale: 1.01,
              lift: -2,
              shadow: baseBoxShadow,
              magnetic: 4,
            };
          default:
            return {
              scale: 1.02,
              lift: -3,
              shadow: "0 10px 24px rgba(17, 24, 39, 0.1)",
              magnetic: 5,
            };
        }
      };

      const config = resolveConfig();

      const handleEnter = () => {
        gsap.to(element, {
          scale: config.scale,
          y: config.lift,
          boxShadow: config.shadow,
          duration: 0.32,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      const handleMove = (event: PointerEvent) => {
        if (config.magnetic <= 0) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const xRatio = (event.clientX - rect.left) / rect.width - 0.5;
        const yRatio = (event.clientY - rect.top) / rect.height - 0.5;

        xTo(xRatio * config.magnetic);
        yTo(config.lift + yRatio * Math.max(4, config.magnetic * 0.7));
      };

      const handleLeave = () => {
        xTo(0);
        yTo(0);
        gsap.to(element, {
          scale: 1,
          x: 0,
          y: 0,
          boxShadow: baseBoxShadow,
          duration: 0.45,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      element.addEventListener("pointerenter", handleEnter);
      element.addEventListener("pointermove", handleMove);
      element.addEventListener("pointerleave", handleLeave);

      return () => {
        element.removeEventListener("pointerenter", handleEnter);
        element.removeEventListener("pointermove", handleMove);
        element.removeEventListener("pointerleave", handleLeave);
        gsap.killTweensOf(element);
      };
    });

    return () => {
      cleanup.forEach((dispose) => dispose());
    };
  }, []);

  return (
    <div className="bg-black">
      <PageEntranceLoader
        title="Jade Palace"
        eyebrow="Jade Palace"
        subtitle="Mandalay jade, unveiled with quiet ceremony."
      >
        <main ref={homeMainRef} className="scroll-smooth">
          <div data-page-intro>
            <ScrollHero />
          </div>

          <ScrollRevealSection start="top 82%">
            <AboutProduct />
          </ScrollRevealSection>
          <ScrollRevealSection start="top 82%">
            <NewArrivals />
          </ScrollRevealSection>
          <ScrollRevealSection start="top 84%">
            <OurProcess />
          </ScrollRevealSection>
          <ScrollRevealSection start="top 84%">
            <LatestInfo />
          </ScrollRevealSection>
          <ScrollRevealSection start="top bottom-=80">
            <Footer />
          </ScrollRevealSection>

          {setupError && (
            <p
              data-page-intro
              className="mt-3 pb-8 text-center text-sm text-red-600"
            >
              Account setup sync failed: {setupError}
            </p>
          )}
        </main>
      </PageEntranceLoader>
    </div>
  );
};

export default HomePage;
