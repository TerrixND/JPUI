"use client";

import GoogleLocationAutocomplete from "@/components/ui/location/GoogleLocationAutocomplete";
import InputBox from "@/components/ui/InputBox";
import {
  ApiClientError,
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
  redirectToBlockedPage,
} from "@/lib/apiClient";
import { type GoogleLocationSelection } from "@/lib/googleMaps";
import {
  bootstrapAdmin,
  clearPendingSetupPayload,
  completePendingSetupForSession,
  isAuthBlockedError,
  precheckSignup,
  resolveOnboardingMode,
  setupUser,
  storePendingSetupPayload,
} from "@/lib/setupUser";
import {
  buildAuthRouteWithReturnTo,
  resolveSafeReturnTo,
} from "@/lib/authRedirect";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";

const languages = [
  { code: "en", label: "English" },
  { code: "ch", label: "China" },
  { code: "th", label: "Thailand" },
  { code: "mm", label: "Myanmar" },
];

const SignupPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo")) || "/";
  const loginHref = buildAuthRouteWithReturnTo("/login", returnTo);

  const [fullName, setFullName] = useState("");
  const [phNo, setPhNo] = useState("");
  const [lineID, setLineID] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedLocation, setSelectedLocation] =
    useState<GoogleLocationSelection | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(languages[0]);

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
      if (!normalizedEmail || !password) {
        throw new Error("Email and password are required.");
      }

      const profilePayload = {
        email: normalizedEmail,
        displayName: fullName.trim() || undefined,
        phone: phNo.trim() || undefined,
        lineId: lineID.trim() || undefined,
        preferredLanguage: selected.code || undefined,
        city: selectedLocation?.city || undefined,
        country: selectedLocation?.country || undefined,
        timezone: selectedLocation?.timezone || undefined,
      };

      const precheckResult = await precheckSignup({
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
        router.replace(`/line/connect-option?returnTo=${encodeURIComponent(returnTo)}`);
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
        await forceLogoutToBlockedPage(
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
        <div>
          <h3 className="text-base font-semibold text-black">Create an account</h3>
          <p className="text-xs text-slate-700 mt-[5px]">
            Create your account and get started.
          </p>
        </div>
        <select
          value={selected.code}
          onChange={(event) => {
            const found = languages.find((lang) => lang.code === event.target.value);
            if (found) {
              setSelected(found);
            }
          }}
          className="w-22 h-10 text-sm bg-white border border-gray-200 shadow-sm text-center focus:outline-none cursor-pointer transition"
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
            onChange={(event) => setFullName(event.target.value)}
            label="Full Name"
            placeholder="Rain John"
            type="text"
          />
          <div className="md:col-span-2">
            <GoogleLocationAutocomplete
              label="City"
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="Search your city"
              helperText="Use Google Places or your current location. Jade Palace stores only city, country, and timezone for customer accounts."
              mode="city"
            />
            {selectedLocation ? (
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {selectedLocation.country ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                    {selectedLocation.country}
                  </span>
                ) : null}
                {selectedLocation.timezone ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                    {selectedLocation.timezone}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <InputBox
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            label="Email Address"
            placeholder="john@gmail.com"
            type="text"
          />
          <InputBox
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            label="Password"
            placeholder="Minimum 8 characters"
            type="password"
          />
          <InputBox
            value={phNo}
            onChange={(event) => setPhNo(event.target.value)}
            label="Phone Number"
            placeholder="+95 #### ####"
            type="text"
          />
          <InputBox
            value={lineID}
            onChange={(event) => setLineID(event.target.value)}
            label="Line ID"
            placeholder="#### ####"
            type="text"
          />
        </div>

        {error ? <p className="text-red-500 text-xs pb-2.5">{error}</p> : null}
        {message ? (
          <p className="text-emerald-700 text-xs pb-2.5">{message}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={`cursor-pointer mt-3 w-full py-3 text-white rounded ${
            loading ? "bg-emerald-500" : "bg-emerald-700"
          }`}
        >
          {loading ? "Signing Up..." : "SIGN UP"}
        </button>

        <p className="text-[13px] text-slate-800 my-8">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-medium text-emerald-600 underline"
          >
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default SignupPage;
