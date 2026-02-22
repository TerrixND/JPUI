"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

const OtpPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendMessage, setResendMessage] = useState("");

  // 🔥 Change this to test true/false
  const CORRECT_OTP = "123456";

  const handleVerify = async () => {
    if (otp.length !== 6) return;

    setLoading(true);
    setError("");

    // Simulate API delay
    setTimeout(() => {
      const isOtpValid = otp === CORRECT_OTP; // ✅ Boolean check

      if (isOtpValid) {
        router.push("/"); // redirect to home
      } else {
        setError("Invalid verification code. Please try again.");
      }

      setLoading(false);
    }, 800);
  };

  const handleResend = () => {
    setResendMessage("A new verification code has been sent.");
    setTimeout(() => setResendMessage(""), 3000);
  };

  return (
    <div className="lg:w-[70%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
      <h3 className="text-base font-semibold text-black">
        Enter Verification Code
      </h3>

      <p className="text-xs text-slate-700 mt-1 mb-6">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-black">{email}</span>
      </p>

      <div className="space-y-6">
        <input
          type="text"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="••••••"
          className="w-full text-center tracking-[0.5em] text-xl py-3 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleVerify}
          disabled={otp.length !== 6 || loading}
          className={`w-full py-3.5 rounded font-medium text-sm transition ${
            otp.length !== 6 || loading
              ? "bg-gray-200 cursor-not-allowed text-gray-400"
              : "bg-linear-to-r from-emerald-700 to-emerald-600 text-white shadow-lg hover:opacity-90"
          }`}
        >
          {loading ? "Verifying..." : "Verify Code"}
        </button>

        {/* Resend Section */}
        <div className="text-sm text-center text-gray-500">
          Didn’t receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            className="text-emerald-700 font-medium hover:underline"
          >
            Resend OTP
          </button>
        </div>

        {/* Resend Section */}
        <div className="text-sm text-center text-gray-500">
          Wrong Email?{" "}
          <Link
            href={"/forgot-password"}
            className="text-emerald-700 font-medium hover:underline"
          >
            Change
          </Link>
        </div>

        {resendMessage && (
          <p className="text-sm text-emerald-600 text-center">
            {resendMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default OtpPage;