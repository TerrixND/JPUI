"use client";

import InputBox from "@/components/ui/InputBox";
import PhoneNumberField from "@/components/ui/PhoneNumberField";
import {
  ApiClientError,
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
} from "@/lib/apiClient";
import { buildAuthRouteWithReturnTo, resolveSafeReturnTo } from "@/lib/authRedirect";
import { resolveLineIdentityFromSupabaseUser } from "@/lib/lineAuth";
import {
  bootstrapAdmin,
  isAuthBlockedError,
  precheckSignup,
  resolveOnboardingMode,
  setupUser as submitSetupUser,
} from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "ch", label: "China" },
  { code: "th", label: "Thailand" },
  { code: "mm", label: "Myanmar" },
];

const isLineShadowEmail = (value: string) =>
  value.trim().toLowerCase().endsWith("@line.local");

function LineSetupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo")) || "/";
  const lineUserIdFromQuery = String(searchParams.get("lineUserId") || "").trim();
  const lineDisplayNameFromQuery = String(
    searchParams.get("lineDisplayName") || "",
  ).trim();

  const currentRoute = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/line/setup?${query}` : "/line/setup";
  }, [searchParams]);
  const loginHref = buildAuthRouteWithReturnTo("/login", currentRoute);

  const [lineUserId, setLineUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0].code);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const hydrate = async () => {
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

        if (!session?.access_token || !session.user) {
          router.replace(loginHref);
          return;
        }

        const identity = resolveLineIdentityFromSupabaseUser(session.user);
        const resolvedLineUserId = identity.lineUserId || lineUserIdFromQuery;
        if (!resolvedLineUserId) {
          throw new Error(
            "LINE setup session is missing identity. Please continue with LINE again.",
          );
        }

        if (!isActive) {
          return;
        }

        setLineUserId(resolvedLineUserId);
        setFullName((prev) => (
          prev || identity.lineDisplayName || lineDisplayNameFromQuery || ""
        ));

        const sessionEmail = String(session.user.email || "").trim();
        if (sessionEmail && !isLineShadowEmail(sessionEmail)) {
          setEmail(sessionEmail);
        }
      } catch (caughtError) {
        if (!isActive) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to initialize LINE setup.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isActive = false;
    };
  }, [lineDisplayNameFromQuery, lineUserIdFromQuery, loginHref, router]);

  const handleCompleteSetup = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!lineUserId) {
        throw new Error("LINE identity is missing. Please continue with LINE again.");
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedDisplayName = fullName.trim();
      const normalizedPhone = phone.trim();

      if (!normalizedEmail || !normalizedDisplayName || !normalizedPhone || !language) {
        throw new Error(
          "Email, display name, phone number, and language are required.",
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
        throw new Error("Your session expired. Please login again.");
      }

      const payload = {
        email: normalizedEmail,
        displayName: normalizedDisplayName,
        phone: normalizedPhone,
        preferredLanguage: language,
        lineUserId,
      };

      const precheckResult = await precheckSignup({
        flow: "SETUP_USER",
        ...payload,
      });
      const onboardingMode = resolveOnboardingMode(precheckResult);

      if (onboardingMode === "bootstrap-admin") {
        await bootstrapAdmin(session.access_token, payload);
      } else {
        await submitSetupUser(session.access_token, payload);
      }

      try {
        await getUserMe({
          accessToken: session.access_token,
        });
      } catch (authError) {
        if (isAccountAccessDeniedError(authError)) {
          await forceLogoutToBlockedPage(
            authError.payload ?? {
              message: authError.message,
              code: authError.code,
            },
          );
          return;
        }

        throw authError;
      }

      router.replace(returnTo);
      router.refresh();
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
          : "Unable to complete LINE setup.",
      );
    } finally {
      setIsSubmitting(false);
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
          Complete LINE Account Setup
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter your profile details to finish setup and continue.
        </p>
        {lineUserId ? (
          <p className="mt-2 text-xs text-gray-500">LINE User ID: {lineUserId}</p>
        ) : null}

        <form className="mt-5" onSubmit={handleCompleteSetup}>
          <div className="space-y-3">
            <InputBox
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              label="Display Name"
              placeholder="Your display name"
              type="text"
            />
            <InputBox
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              label="Email Address"
              placeholder="you@example.com"
              type="text"
            />
            <PhoneNumberField
              label="Phone Number"
              value={phone}
              onChange={setPhone}
              placeholder="Enter your phone number"
              helperText="Choose the right country code before saving your account."
            />

            <label className="block text-xs text-slate-700">
              Language
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 w-full rounded bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Completing Setup..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LineSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <LineSetupPageContent />
    </Suspense>
  );
}
