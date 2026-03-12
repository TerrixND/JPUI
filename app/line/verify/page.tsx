"use client";

import {
  ApiClientError,
  forceLogoutToBlockedPage,
  isAccountAccessDeniedError,
  startUserLineOfficialOtpVerification,
  updateUserMeProfile,
  verifyUserLineOfficialOtpVerification,
} from "@/lib/apiClient";
import { buildAuthRouteWithReturnTo, resolveSafeReturnTo } from "@/lib/authRedirect";
import {
  checkLineAccount,
  consumePendingLineAuthContext,
  exchangeLineAuthorizationCode,
} from "@/lib/lineAuth";
import {
  isAuthBlockedError,
  precheckLogin,
} from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const LINE_OFFICIAL_ACCOUNT_URL = "https://line.me/R/ti/p/%40404isuyx#~";
const normalizeOtpInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);

type VerifyIntent = "signup" | "connect" | "login";

const normalizeVerifyIntent = (value: unknown): VerifyIntent => {
  if (value === "connect") return "connect";
  if (value === "login") return "login";
  return "signup";
};

const buildVerifyRoute = ({
  intent,
  returnTo,
  lineUserId,
  lineDisplayName,
}: {
  intent: VerifyIntent;
  returnTo: string;
  lineUserId: string;
  lineDisplayName: string | null;
}) => {
  const url = new URL("/line/verify", window.location.origin);
  url.searchParams.set("intent", intent);
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("lineUserId", lineUserId);
  if (lineDisplayName) {
    url.searchParams.set("lineDisplayName", lineDisplayName);
  }

  return `${url.pathname}${url.search}`;
};

function LineOfficialVerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasBootstrappedRef = useRef(false);

  const [bootstrapping, setBootstrapping] = useState(true);
  const [intent, setIntent] = useState<VerifyIntent>("signup");
  const [returnTo, setReturnTo] = useState("/");
  const [lineUserId, setLineUserId] = useState("");
  const [lineDisplayName, setLineDisplayName] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    const run = async () => {
      try {
        if (!isSupabaseConfigured) {
          throw new Error(
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
          );
        }

        const params = new URLSearchParams(window.location.search);
        const isLineAuthCallback = params.get("lineAuth") === "1";
        const hasAuthCode = Boolean(params.get("code"));
        const lineOauthError = params.get("error");
        const lineOauthErrorDescription = params.get("error_description");

        if (isLineAuthCallback && lineOauthError) {
          throw new Error(
            lineOauthErrorDescription || `LINE authorization failed: ${lineOauthError}`,
          );
        }

        if (isLineAuthCallback && hasAuthCode) {
          const pendingLineAuth = consumePendingLineAuthContext(params.get("state"));
          const callbackIntent = normalizeVerifyIntent(pendingLineAuth.intent);
          const callbackReturnTo =
            resolveSafeReturnTo(pendingLineAuth.returnTo) || "/";

          let lineExchangeResult: Awaited<
            ReturnType<typeof exchangeLineAuthorizationCode>
          >;
          try {
            lineExchangeResult = await exchangeLineAuthorizationCode({
              code: String(params.get("code") || ""),
              nonce: pendingLineAuth.nonce,
              redirectUri: pendingLineAuth.redirectUri,
              intent: pendingLineAuth.intent,
            });
          } catch (exchangeError) {
            const message =
              exchangeError instanceof Error
                ? exchangeError.message
                : "Unable to exchange LINE authorization code.";

            if (callbackIntent === "login" || callbackIntent === "signup") {
              const loginRoute = new URL(
                buildAuthRouteWithReturnTo("/login", callbackReturnTo),
                window.location.origin,
              );
              loginRoute.searchParams.set("lineAuthError", message);
              router.replace(`${loginRoute.pathname}${loginRoute.search}`);
              return;
            }

            throw exchangeError;
          }

          const callbackLineUserId = lineExchangeResult.lineIdentity.lineUserId || "";
          const callbackLineDisplayName =
            lineExchangeResult.lineIdentity.lineDisplayName || "";

          if (callbackIntent === "signup") {
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

          if (callbackIntent === "connect") {
            const {
              data: { session },
              error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError) {
              throw new Error(sessionError.message);
            }
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
                lineDisplayName: callbackLineDisplayName || null,
                linePictureUrl:
                  lineExchangeResult.lineIdentity.linePictureUrl || null,
                lineNotificationsEnabled: false,
              },
            });
          } else {
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

            if (callbackIntent === "login" && callbackLineUserId) {
              await precheckLogin({
                lineUserId: callbackLineUserId,
              });
              router.replace(callbackReturnTo);
              return;
            }
          }

          if (!callbackLineUserId) {
            throw new Error(
              "Unable to resolve LINE identity. Please continue with LINE again.",
            );
          }

          setIntent(callbackIntent);
          setReturnTo(callbackReturnTo);
          setLineUserId(callbackLineUserId);
          setLineDisplayName(callbackLineDisplayName || "");

          router.replace(
            buildVerifyRoute({
              intent: callbackIntent,
              returnTo: callbackReturnTo,
              lineUserId: callbackLineUserId,
              lineDisplayName: callbackLineDisplayName || null,
            }),
          );
          return;
        }

        const nextIntent = normalizeVerifyIntent(searchParams.get("intent"));
        const nextReturnTo = resolveSafeReturnTo(searchParams.get("returnTo")) || "/";
        const nextLineUserId = String(searchParams.get("lineUserId") || "").trim();
        const nextLineDisplayName = String(searchParams.get("lineDisplayName") || "").trim();

        if (nextIntent === "login") {
          router.replace(nextReturnTo);
          return;
        }

        if (!nextLineUserId) {
          throw new Error(
            "LINE verification session is missing. Please continue with LINE again.",
          );
        }

        setIntent(nextIntent);
        setReturnTo(nextReturnTo);
        setLineUserId(nextLineUserId);
        setLineDisplayName(nextLineDisplayName);
      } catch (caughtError) {
        if (isAuthBlockedError(caughtError)) {
          await supabase.auth.signOut().catch(() => undefined);
          router.replace("/blocked");
          return;
        }

        if (
          caughtError instanceof ApiClientError &&
          isAccountAccessDeniedError(caughtError)
        ) {
          await forceLogoutToBlockedPage(
            caughtError.payload ?? {
              message: caughtError.message,
              code: caughtError.code,
            },
          );
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to initialize LINE verification flow.",
        );
      } finally {
        setBootstrapping(false);
      }
    };

    void run();
  }, [router, searchParams]);

  const getSessionAccessToken = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }
    if (!session?.access_token) {
      throw new Error("Your session expired. Please login again.");
    }

    return session.access_token;
  };

  const handleSendCode = async () => {
    setError("");
    setMessage("");
    setIsSendingCode(true);

    try {
      const accessToken = await getSessionAccessToken();
      const response = await startUserLineOfficialOtpVerification({
        accessToken,
      });

      setChallengeId(response.challenge?.id || "");
      setExpiresAt(response.challenge?.expiresAt || "");
      setMessage(response.message || "Verification code sent to your LINE account.");
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        isAccountAccessDeniedError(caughtError)
      ) {
        await forceLogoutToBlockedPage(
          caughtError.payload ?? {
            message: caughtError.message,
            code: caughtError.code,
          },
        );
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to send LINE verification code.",
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    setMessage("");
    setIsVerifyingCode(true);

    try {
      if (!challengeId) {
        throw new Error("Please click Send Code first.");
      }

      if (otp.length !== 6) {
        throw new Error("Please enter a valid 6-digit code.");
      }

      const accessToken = await getSessionAccessToken();
      const response = await verifyUserLineOfficialOtpVerification({
        accessToken,
        challengeId,
        otp,
      });

      setMessage(
        response.message || "LINE Official Account verified successfully.",
      );

      if (intent === "signup") {
        const setupUrl = new URL("/line/setup", window.location.origin);
        setupUrl.searchParams.set("returnTo", returnTo);
        setupUrl.searchParams.set("lineUserId", lineUserId);
        if (lineDisplayName) {
          setupUrl.searchParams.set("lineDisplayName", lineDisplayName);
        }
        router.replace(`${setupUrl.pathname}${setupUrl.search}`);
        return;
      }

      if (intent === "connect") {
        const connectedRoute = new URL(returnTo, window.location.origin);
        connectedRoute.searchParams.set("lineConnected", "1");
        router.replace(`${connectedRoute.pathname}${connectedRoute.search}`);
        return;
      }

      router.replace(returnTo);
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        isAccountAccessDeniedError(caughtError)
      ) {
        await forceLogoutToBlockedPage(
          caughtError.payload ?? {
            message: caughtError.message,
            code: caughtError.code,
          },
        );
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to verify LINE code.",
      );
    } finally {
      setIsVerifyingCode(false);
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-white px-6 py-20">
        <p className="text-sm text-gray-600">Preparing LINE verification...</p>
      </div>
    );
  }

  const disableVerify =
    !challengeId || otp.length !== 6 || isSendingCode || isVerifyingCode;
  const loginHref = buildAuthRouteWithReturnTo("/login", "/line/verify");

  return (
    <div className="min-h-screen bg-white px-6 py-20">
      <div className="mx-auto w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">
          Verify LINE Official Account
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Please add our LINE Official Account to receive notifications. Once done,
          click Send Code.
        </p>

        {lineDisplayName ? (
          <p className="mt-2 text-xs text-gray-500">
            LINE account: {lineDisplayName}
          </p>
        ) : null}
        {lineUserId ? (
          <p className="text-xs text-gray-500">LINE User ID: {lineUserId}</p>
        ) : null}

        <a
          href={LINE_OFFICIAL_ACCOUNT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Add LINE Official Account
        </a>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSendCode}
            disabled={isSendingCode || isVerifyingCode}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSendingCode ? "Sending..." : "Send Code"}
          </button>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(normalizeOtpInput(event.target.value))}
            placeholder="Enter 6-digit code"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm sm:w-56"
          />

          <button
            type="button"
            onClick={handleVerifyCode}
            disabled={disableVerify}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifyingCode ? "Verifying..." : "Verify Code"}
          </button>
        </div>

        {expiresAt ? (
          <p className="mt-2 text-xs text-gray-500">
            Code expires at: {new Date(expiresAt).toLocaleString()}
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

        {error ? (
          <p className="mt-3 text-xs text-gray-600">
            Session issue? Continue with{" "}
            <a href={loginHref} className="text-emerald-700 underline">
              login
            </a>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function LineOfficialVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <LineOfficialVerifyPageContent />
    </Suspense>
  );
}
