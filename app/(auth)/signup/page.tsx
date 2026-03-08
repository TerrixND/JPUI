"use client";

import InputBox from "@/components/ui/InputBox";
import {
  ApiClientError,
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
  redirectToBlockedPage,
} from "@/lib/apiClient";
import {
  isAuthBlockedError,
  bootstrapAdmin,
  clearPendingSetupPayload,
  completePendingSetupForSession,
  precheckSignup,
  resolveOnboardingMode,
  setupUser,
  storePendingSetupPayload,
} from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import {
  buildAuthRouteWithReturnTo,
  resolveSafeReturnTo,
} from "@/lib/authRedirect";
import {
  resolveLineIdentityFromSupabaseUser,
  startLineOAuth,
} from "@/lib/lineAuth";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";

const languages = [
  {
    code: "en",
    label: "English",
  },
  {
    code: "ch",
    label: "China",
  },
  {
    code: "th",
    label: "Thailand",
  },
  {
    code: "mm",
    label: "Myanmar",
  },
];

const SignupPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo")) || "/";
  const isLineSetupMode = searchParams.get("lineSetup") === "1";
  const lineUserIdFromQuery = searchParams.get("lineUserId");
  const lineDisplayNameFromQuery = searchParams.get("lineDisplayName");
  const loginHref = buildAuthRouteWithReturnTo("/login", returnTo);

  const [fullName, setFullName] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [phNo, setPhNo] = useState<string>("");
  const [lineID, setLineID] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(
    lineUserIdFromQuery?.trim() || null,
  );
  const [selected, setSelected] = useState(languages[0]);

  useEffect(() => {
    if (!isLineSetupMode) {
      return;
    }

    let isActive = true;

    const hydrateLineSetupSession = async () => {
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
        const fallbackLineUserId = lineUserIdFromQuery?.trim() || null;
        const resolvedLineUserId = identity.lineUserId || fallbackLineUserId;
        if (!resolvedLineUserId) {
          throw new Error(
            "Unable to resolve LINE identity from session. Please continue with LINE again.",
          );
        }

        if (!isActive) {
          return;
        }

        setLineUserId(resolvedLineUserId);
        setEmail((prev) => prev || session.user.email || "");
        setFullName(
          (prev) =>
            prev ||
            identity.lineDisplayName ||
            lineDisplayNameFromQuery?.trim() ||
            "",
        );
      } catch (err) {
        if (!isActive) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to initialize LINE account setup.",
        );
      }
    };

    hydrateLineSetupSession();

    return () => {
      isActive = false;
    };
  }, [
    isLineSetupMode,
    lineDisplayNameFromQuery,
    lineUserIdFromQuery,
    loginHref,
    router,
  ]);

  const handleLineContinue = async () => {
    setError("");
    setMessage("");
    setLineLoading(true);

    try {
      await startLineOAuth({
        returnTo,
        intent: "signup",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to continue with LINE.",
      );
      setLineLoading(false);
    }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      const profilePayload = {
        email: normalizedEmail || undefined,
        displayName: fullName.trim() || undefined,
        phone: phNo.trim() || undefined,
        lineId: isLineSetupMode ? undefined : lineID.trim() || undefined,
        preferredLanguage: selected.code || undefined,
        city: city.trim() || undefined,
      };

      if (isLineSetupMode) {
        if (
          !normalizedEmail ||
          !profilePayload.displayName ||
          !profilePayload.phone ||
          !profilePayload.city
        ) {
          throw new Error(
            "Display name, email, city, and phone number are required to complete LINE setup.",
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
          throw new Error(
            "LINE session expired. Please continue with LINE again.",
          );
        }

        const identity = resolveLineIdentityFromSupabaseUser(session.user);
        const resolvedLineUserId =
          identity.lineUserId ||
          lineUserId ||
          lineUserIdFromQuery?.trim() ||
          null;
        if (!resolvedLineUserId) {
          throw new Error(
            "Unable to resolve LINE identity from session. Please continue with LINE again.",
          );
        }

        const lineSetupPayload = {
          ...profilePayload,
          lineUserId: resolvedLineUserId,
        };

        const precheckResult = await precheckSignup({
          email: normalizedEmail,
          lineUserId: resolvedLineUserId,
          flow: "SETUP_USER",
          ...lineSetupPayload,
        });
        const onboardingMode = resolveOnboardingMode(precheckResult);

        if (onboardingMode === "bootstrap-admin") {
          await bootstrapAdmin(session.access_token, lineSetupPayload);
        } else {
          await setupUser(session.access_token, lineSetupPayload);
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

        clearPendingSetupPayload();
        router.replace(returnTo);
        router.refresh();
        return;
      }

      if (!normalizedEmail || !password) {
        throw new Error("Email and password are required.");
      }

      const precheckResult = await precheckSignup({
        email: normalizedEmail,
        flow: "SETUP_USER",
        ...profilePayload,
      });
      const onboardingMode = resolveOnboardingMode(precheckResult);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: profilePayload,
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (data.session?.access_token) {
        if (onboardingMode === "bootstrap-admin") {
          await bootstrapAdmin(data.session.access_token, profilePayload);
        } else {
          await setupUser(data.session.access_token, profilePayload);
        }

        await completePendingSetupForSession({
          accessToken: data.session.access_token,
          email: data.session.user?.email || normalizedEmail,
        });

        try {
          await getUserMe({
            accessToken: data.session.access_token,
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

        clearPendingSetupPayload();
        router.replace(returnTo);
        router.refresh();
        return;
      }

      storePendingSetupPayload(normalizedEmail, profilePayload, onboardingMode);
      setMessage(
        "Sign up successful. Verify your email, then login to finish account setup.",
      );
    } catch (err) {
      if (isAuthBlockedError(err)) {
        if (isSupabaseConfigured) {
          await supabase.auth.signOut().catch(() => undefined);
        }

        redirectToBlockedPage({
          message: err.message,
          code: err.code,
          details: err.details,
        });
        return;
      }

      if (err instanceof ApiClientError && isAccountAccessDeniedError(err)) {
        void forceLogoutToBlockedPage(
          err.payload ?? {
            message: err.message,
            code: err.code,
          },
        );
        return;
      }

      setError(err instanceof Error ? err.message : "Unable to sign up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg:w-[100%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center mb-10">
      <div className="flex justify-between items-center flex-wrap mb-6 gap-4">
        <div className="">
          <h3 className="text-base font-semibold text-black">
            {isLineSetupMode
              ? "Complete LINE Account Setup"
              : "Create an account"}
          </h3>
          <p className="text-xs text-slate-700 mt-[5px]">
            {isLineSetupMode
              ? "Add your profile details to finish setup."
              : "Create your account and get started."}
          </p>
        </div>
        <select
          value={selected.code}
          onChange={(e) =>
            setSelected(languages.find((l) => l.code === e.target.value)!)
          }
          className="
    w-22 h-10
    text-sm
    bg-white
    border border-gray-200
    shadow-sm
    text-center
    focus:outline-none
   
    
    cursor-pointer
    transition
  "
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSignUp}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputBox
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            label="Full Name"
            placeholder="Rain John"
            type="text"
          />
          <InputBox
            value={city}
            onChange={(e) => setCity(e.target.value)}
            label="City"
            placeholder="Bangkok"
            type="text"
          />
          <InputBox
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label="Email Address"
            placeholder="john@gmail.com"
            type="text"
          />
          {!isLineSetupMode && (
            <InputBox
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Password"
              placeholder="Minimum 8 characters"
              type="password"
            />
          )}
          <InputBox
            value={phNo}
            onChange={(e) => setPhNo(e.target.value)}
            label="Phone Number"
            placeholder="+95 #### ####"
            type="text"
          />
          {!isLineSetupMode && (
            <InputBox
              value={lineID}
              onChange={(e) => setLineID(e.target.value)}
              label="Line ID"
              placeholder="#### ####"
              type="text"
            />
          )}
          {/* <div className="col-span-2">
            <InputBox
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Password"
              placeholder="Minimum 8 characters"
              type="password"
            />
          </div> */}
        </div>

        {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}
        {message && (
          <p className="text-emerald-700 text-xs pb-2.5">{message}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`cursor-pointer mt-3 w-full py-3 text-white rounded ${
            loading ? "bg-emerald-500" : "bg-emerald-700"
          }`}
        >
          {loading
            ? isLineSetupMode
              ? "Completing Setup..."
              : "Signing Up..."
            : isLineSetupMode
              ? "COMPLETE SETUP"
              : "SIGN UP"}
        </button>
        {!isLineSetupMode && (
          <div className="w-full flex gap-3 mt-5 flex-wrap">
            <button
              type="button"
              onClick={handleLineContinue}
              disabled={loading || lineLoading}
              className="
              flex-1 min-w-40
      group
      flex items-center justify-center gap-3
      px-4 py-3.5
      bg-white
      border border-gray-200
      rounded-lg
      shadow-sm
      hover:shadow-md hover:border-gray-300
      transition-all duration-200
      cursor-pointer
    "
            >
              <Image
                src="/icons/Google.png"
                alt="Line logo"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
              <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                {lineLoading ? "Redirecting to LINE..." : "Continue with Line"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleLineContinue}
              disabled={loading || lineLoading}
              className="
              flex-1 min-w-40
      group
      flex items-center justify-center gap-3
      px-4 py-3.5
      bg-white
      border border-gray-200
      rounded-lg
      shadow-sm
      hover:shadow-md hover:border-gray-300
      transition-all duration-200
      cursor-pointer
    "
            >
              <Image
                src="/icons/Line.png"
                alt="Line logo"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
              <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                {lineLoading ? "Redirecting to LINE..." : "Continue with Line"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleLineContinue}
              disabled={loading || lineLoading}
              className="
              flex-1 min-w-40
      group
      flex items-center justify-center gap-3
      px-4 py-3.5
      bg-white
      border border-gray-200
      rounded-lg
      shadow-sm
      hover:shadow-md hover:border-gray-300
      transition-all duration-200
      cursor-pointer
    "
            >
              <Image
                src="/icons/facebook.png"
                alt="Line logo"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
              <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                {lineLoading ? "Redirecting to LINE..." : "Continue with Line"}
              </span>
            </button>
          </div>
        )}
        {!isLineSetupMode && (
          <p className="text-[13px] text-slate-800 my-8">
            Already have an account?{" "}
            <Link
              href={loginHref}
              className="font-medium text-emerald-600 underline"
            >
              Login
            </Link>
          </p>
        )}
      </form>
    </div>
  );
};

export default SignupPage;
