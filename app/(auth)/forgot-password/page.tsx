"use client";

import InputBox from "@/components/ui/InputBox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ForgotPasswordPage = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return;

    setLoading(true);

    // 🔥 Call your API / Supabase reset here
    // await supabase.auth.resetPasswordForEmail(email);

    setTimeout(() => {
      setLoading(false);

      // Redirect to OTP page
      router.push(`/otp?email=${encodeURIComponent(email)}`);
    }, 1000);
  };

  return (
    <div className="lg:w-[70%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
      <h3 className="text-base font-semibold text-black">
        Reset Your Password
      </h3>

      <p className="text-xs text-slate-700 mt-1 mb-6">
        Enter your registered email address and we’ll send you a secure
        verification code.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <InputBox
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          label="Email Address"
          placeholder="you@example.com"
          type="email"
        />

        <button
          type="submit"
          disabled={!isValidEmail(email) || loading}
          className={`w-full py-3.5 rounded font-medium text-sm transition ${
            !isValidEmail(email) || loading
              ? "bg-gray-200 cursor-not-allowed text-gray-400"
              : "bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-lg hover:opacity-90"
          }`}
        >
          {loading ? "Sending..." : "Continue"}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-gray-500">
        Remember your password?{" "}
        <Link
          href="/login"
          className="text-emerald-700 font-medium hover:underline"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;