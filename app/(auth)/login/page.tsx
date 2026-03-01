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
  precheckLogin,
} from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const LoginPage = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
        );
      }

      const normalizedEmail = email.trim();
      if (!normalizedEmail || !password) {
        throw new Error("Email and password are required.");
      }

      await precheckLogin({
        email: normalizedEmail,
      });

      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        {
          email: normalizedEmail,
          password,
        },
      );

      if (signInError || !data.session?.access_token) {
        throw new Error(signInError?.message || "Unable to login.");
      }

      try {
        await getUserMe({
          accessToken: data.session.access_token,
        });
      } catch (error) {
        if (isAccountAccessDeniedError(error)) {
          await forceLogoutToBlockedPage(
            error.payload ?? {
              message: error.message,
              code: error.code,
            },
          );
          return;
        }

        throw error;
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      if (isAuthBlockedError(err)) {
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

      setError(err instanceof Error ? err.message : "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg:w-[70%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
      <h3 className="text-base font-semibold text-black">Welcome Back</h3>
      <p className="text-xs text-slate-700 mt-1.25 mb-6">
        Enter your information to proceed.
      </p>
      <form onSubmit={handleLogin}>
        <InputBox
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          label="Email Address"
          placeholder="you@gmail.com"
          type="text"
        />
        <InputBox
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          label="Password"
          placeholder="Minimum 8 characters"
          type="password"
        />
        {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 text-white rounded cursor-pointer mt-3 ${
            loading ? "bg-emerald-500" : "bg-emerald-700"
          }`}
        >
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>

        <div className="w-full flex gap-3 mt-5 flex-wrap">
          <Link
            href={"/signup"}
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
              alt="Google logo"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
            <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
              Continue with Google
            </span>
          </Link>

          <Link
            href={"/signup"}
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
              Continue with Line
            </span>
          </Link>

          <Link
            href={"/signup"}
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
              alt="Facebook logo"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
            <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
              Continue with Facebook
            </span>
          </Link>
        </div>

        <div className="flex justify-between  mt-5 ">
          <p className="text-[13px] text-slate-800">
            Forgot{" "}
            <Link
              href={"/forgot-password"}
              className="font-medium text-emerald-700 underline"
            >
              Password?
            </Link>
          </p>

          <p className="text-[13px] text-slate-800">
            Don&apos;t have an account?{" "}
            <Link
              href={"/signup"}
              className="font-medium text-emerald-700 underline"
            >
              SignUp
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
