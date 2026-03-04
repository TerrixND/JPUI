"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiClientError,
  forceLogoutToBlockedPage,
  isAccountAccessDeniedError,
  redirectToBlockedPage,
  startCustomerOwnershipClaimOtp,
  verifyCustomerOwnershipClaimOtp,
} from "@/lib/apiClient";
import { buildAuthRouteWithReturnTo } from "@/lib/authRedirect";
import { completePendingSetupForSession, isAuthBlockedError } from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";

const CORRECT_OTP = "123456";

const normalizeOtpInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const sanitizeInternalReturnTo = (value: string | null, fallbackValue = "/") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.startsWith("/") ? normalized : fallbackValue;
};

const appendOwnershipClaimVerifiedParam = (path: string) => {
  const fallbackPath = sanitizeInternalReturnTo(path, "/");

  try {
    const parsed = new URL(fallbackPath, "https://jade-palace.local");
    parsed.searchParams.set("claim", "verified");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = fallbackPath.includes("?") ? "&" : "?";
    return `${fallbackPath}${separator}claim=verified`;
  }
};

const OtpPageContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");
  const flow = (searchParams.get("flow") || "").trim().toLowerCase();
  const cardToken = searchParams.get("cardToken");
  const productId = searchParams.get("productId");
  const returnTo = sanitizeInternalReturnTo(searchParams.get("returnTo"), "/");
  const isOwnershipClaimFlow = flow === "ownership-claim";
  const currentOtpPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/otp?${query}` : "/otp";
  }, [searchParams]);
  const loginHref = useMemo(
    () => buildAuthRouteWithReturnTo("/login", currentOtpPath),
    [currentOtpPath],
  );

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(isOwnershipClaimFlow);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  const getAccessToken = useCallback(async () => {
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
      throw new ApiClientError({
        message: "Missing access token. Please sign in again.",
        status: 401,
        code: "UNAUTHORIZED",
      });
    }

    await completePendingSetupForSession({
      accessToken: session.access_token,
      email: session.user?.email,
    });

    return session.access_token;
  }, []);

  const startOwnershipClaimOtp = useCallback(async () => {
    if (!isOwnershipClaimFlow) {
      return;
    }

    if (!cardToken && !productId) {
      setError("Missing ownership claim reference.");
      setBootstrapping(false);
      return;
    }

    setBootstrapping(true);
    setLoading(false);
    setError("");
    setMessage("");
    setOtp("");
    setChallengeId("");
    setMaskedEmail("");

    try {
      const accessToken = await getAccessToken();
      const response = await startCustomerOwnershipClaimOtp({
        accessToken,
        productId,
        cardToken,
      });

      setChallengeId(response.challenge?.id || "");
      setMaskedEmail(response.challenge?.maskedEmail || "");
      setMessage(response.message || "Verification code sent.");
    } catch (caughtError) {
      if (isAuthBlockedError(caughtError)) {
        await supabase.auth.signOut().catch(() => undefined);
        redirectToBlockedPage({
          message: caughtError.message,
          code: caughtError.code,
          details: caughtError.details,
        });
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

      if (caughtError instanceof ApiClientError && caughtError.status === 401) {
        router.replace(loginHref);
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to send ownership verification code.",
      );
    } finally {
      setBootstrapping(false);
    }
  }, [cardToken, getAccessToken, isOwnershipClaimFlow, loginHref, productId, router]);

  useEffect(() => {
    if (!isOwnershipClaimFlow) {
      setBootstrapping(false);
      return;
    }

    void startOwnershipClaimOtp();
  }, [isOwnershipClaimFlow, startOwnershipClaimOtp]);

  const handleVerifyOwnershipClaim = useCallback(async () => {
    if (!challengeId || otp.length !== 6) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await verifyCustomerOwnershipClaimOtp({
        accessToken,
        challengeId,
        otp,
      });

      setMessage(response.message || "Ownership claimed successfully.");
      router.replace(appendOwnershipClaimVerifiedParam(returnTo));
    } catch (caughtError) {
      if (isAuthBlockedError(caughtError)) {
        await supabase.auth.signOut().catch(() => undefined);
        redirectToBlockedPage({
          message: caughtError.message,
          code: caughtError.code,
          details: caughtError.details,
        });
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

      if (caughtError instanceof ApiClientError && caughtError.status === 401) {
        router.replace(loginHref);
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to verify ownership code.",
      );
    } finally {
      setLoading(false);
    }
  }, [challengeId, getAccessToken, loginHref, otp, returnTo, router]);

  const handleFallbackVerify = () => {
    if (otp.length !== 6) {
      return;
    }

    setLoading(true);
    setError("");

    window.setTimeout(() => {
      if (otp === CORRECT_OTP) {
        router.push("/");
      } else {
        setError("Invalid verification code. Please try again.");
      }

      setLoading(false);
    }, 800);
  };

  const handleResend = () => {
    if (isOwnershipClaimFlow) {
      void startOwnershipClaimOtp();
      return;
    }

    setMessage("A new verification code has been sent.");
    window.setTimeout(() => setMessage(""), 3000);
  };

  const heading = isOwnershipClaimFlow
    ? "Verify Ownership Claim"
    : "Enter Verification Code";
  const description = isOwnershipClaimFlow
    ? maskedEmail
      ? `We sent a 6-digit code to ${maskedEmail}.`
      : "We are preparing your ownership verification code."
    : `We sent a 6-digit code to ${email || "your email address"}`;

  return (
    <div className="lg:w-[70%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
      <h3 className="text-base font-semibold text-black">
        {heading}
      </h3>

      <p className="text-xs text-slate-700 mt-1 mb-6">
        {description}
      </p>

      <div className="space-y-6">
        <input
          type="text"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(normalizeOtpInput(event.target.value))}
          placeholder="••••••"
          disabled={bootstrapping}
          className="w-full text-center tracking-[0.5em] text-xl py-3 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-100 disabled:text-gray-400"
        />

        {bootstrapping ? (
          <p className="text-sm text-slate-500">
            Sending verification code...
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        {message ? (
          <p className="text-sm text-emerald-600">{message}</p>
        ) : null}

        <button
          onClick={isOwnershipClaimFlow ? handleVerifyOwnershipClaim : handleFallbackVerify}
          disabled={otp.length !== 6 || loading || bootstrapping || !challengeId && isOwnershipClaimFlow}
          className={`w-full py-3.5 rounded font-medium text-sm transition ${
            otp.length !== 6 || loading || bootstrapping || (!challengeId && isOwnershipClaimFlow)
              ? "bg-gray-200 cursor-not-allowed text-gray-400"
              : "bg-linear-to-r from-emerald-700 to-emerald-600 text-white shadow-lg hover:opacity-90"
          }`}
        >
          {loading ? "Verifying..." : "Verify Code"}
        </button>

        <div className="text-sm text-center text-gray-500">
          Didn’t receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={bootstrapping || loading}
            className="text-emerald-700 font-medium hover:underline disabled:opacity-50"
          >
            Resend OTP
          </button>
        </div>

        {isOwnershipClaimFlow ? (
          <div className="text-sm text-center text-gray-500">
            Return to{" "}
            <Link
              href={returnTo}
              className="text-emerald-700 font-medium hover:underline"
            >
              Authenticity Page
            </Link>
          </div>
        ) : (
          <div className="text-sm text-center text-gray-500">
            Wrong Email?{" "}
            <Link
              href="/forgot-password"
              className="text-emerald-700 font-medium hover:underline"
            >
              Change
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const OtpPage = () => {
  return (
    <Suspense fallback={<div className="lg:w-[70%] h-full" />}>
      <OtpPageContent />
    </Suspense>
  );
};

export default OtpPage;
