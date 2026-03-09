"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  ApiClientError,
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
  signOutAndRedirect,
  syncUserMeEmailFromSupabase,
  type UserMeResponse,
} from "@/lib/apiClient";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const normalizeOtpInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);
const normalizeEmailInput = (value: string) => value.trim().toLowerCase();

const resolveAuthProviderLabel = (value: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "UNKNOWN";
  if (normalized === "SUPABASE") return "EMAIL_PASSWORD";
  return normalized;
};

export default function ProfileSecurityPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserMeResponse | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingEmail, setIsRefreshingEmail] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSendingPasswordOtp, setIsSendingPasswordOtp] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const authProviderLabel = useMemo(
    () => resolveAuthProviderLabel(me?.authProvider ?? null),
    [me?.authProvider],
  );
  const isLineAuthAccount = authProviderLabel === "LINE";

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleApiAuthError = useCallback(async (caughtError: unknown) => {
    if (isAccountAccessDeniedError(caughtError)) {
      await forceLogoutToBlockedPage(
        caughtError.payload ?? {
          message: caughtError.message,
          code: caughtError.code,
        },
      );
      return true;
    }

    if (caughtError instanceof ApiClientError && caughtError.status === 401) {
      await signOutAndRedirect("/login");
      return true;
    }

    return false;
  }, []);

  const getSessionAccessTokenOrThrow = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }
    if (!session?.access_token) {
      throw new Error("Your session has expired. Please login again.");
    }

    return session.access_token;
  };

  const refreshProfile = useCallback(async (accessToken: string) => {
    try {
      const synced = await syncUserMeEmailFromSupabase({
        accessToken,
      });
      setMe(synced);
      setNewEmail(synced.email || "");
      return synced;
    } catch (syncError) {
      if (await handleApiAuthError(syncError)) {
        return null;
      }

      const fallback = await getUserMe({
        accessToken,
      });
      setMe(fallback);
      setNewEmail(fallback.email || "");
      throw syncError;
    }
  }, [handleApiAuthError]);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setError("");

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

        if (!session?.access_token) {
          router.replace("/login?returnTo=/profile/security");
          return;
        }

        try {
          await refreshProfile(session.access_token);
        } catch (syncError) {
          if (!isActive) return;
          setError(
            syncError instanceof Error
              ? syncError.message
              : "Unable to sync account email from Supabase.",
          );
        }
      } catch (caughtError) {
        if (!isActive) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load security settings.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [refreshProfile, router]);

  const validatePasswordInput = () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (newPassword !== confirmPassword) {
      return "Password confirmation does not match.";
    }
    return "";
  };

  const handleRefreshEmailStatus = async () => {
    clearFeedback();
    setIsRefreshingEmail(true);

    try {
      const {
        data: refreshedData,
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError) {
        throw new Error(refreshError.message);
      }

      const nextAccessToken =
        refreshedData.session?.access_token || (await getSessionAccessTokenOrThrow());
      const refreshed = await refreshProfile(nextAccessToken);
      if (!refreshed) {
        return;
      }
      setSuccess("Email status refreshed from Supabase.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to refresh email status.",
      );
    } finally {
      setIsRefreshingEmail(false);
    }
  };

  const handleSubmitEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();

    if (isLineAuthAccount) {
      setError("Email change is disabled for LINE authenticated accounts.");
      return;
    }

    const normalizedEmail = normalizeEmailInput(newEmail);
    const currentEmail = normalizeEmailInput(me?.email || "");

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (normalizedEmail === currentEmail) {
      setError("New email must be different from your current email.");
      return;
    }

    setIsSubmittingEmail(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        email: normalizedEmail,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      const accessToken = await getSessionAccessTokenOrThrow();
      let syncedNow = false;
      try {
        const refreshed = await refreshProfile(accessToken);
        if (!refreshed) {
          return;
        }
        syncedNow = normalizeEmailInput(refreshed?.email || "") === normalizedEmail;
      } catch (syncError) {
        if (await handleApiAuthError(syncError)) {
          return;
        }
      }

      if (syncedNow) {
        setSuccess("Email updated successfully.");
      } else {
        const pendingTarget = normalizeEmailInput(data.user?.new_email || normalizedEmail);
        setSuccess(
          `Email change requested for ${pendingTarget}. Confirm the verification email, then click "Refresh Email Status".`,
        );
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update email.",
      );
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleOpenPasswordModal = () => {
    clearFeedback();

    if (isLineAuthAccount) {
      setError("Password change is disabled for LINE authenticated accounts.");
      return;
    }

    const validationError = validatePasswordInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    setPasswordOtp("");
    setPasswordOtpSent(false);
    setIsPasswordModalOpen(true);
  };

  const handleSendPasswordOtp = async () => {
    clearFeedback();

    const validationError = validatePasswordInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSendingPasswordOtp(true);
    try {
      const { error: reauthError } = await supabase.auth.reauthenticate();
      if (reauthError) {
        throw new Error(reauthError.message);
      }

      setPasswordOtpSent(true);
      setSuccess("Verification code sent. Enter the 6 digit OTP to confirm password change.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to send password verification code.",
      );
    } finally {
      setIsSendingPasswordOtp(false);
    }
  };

  const handleConfirmPasswordUpdate = async () => {
    clearFeedback();

    const validationError = validatePasswordInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (passwordOtp.length !== 6) {
      setError("Enter a 6 digit OTP.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        nonce: passwordOtp,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setIsPasswordModalOpen(false);
      setPasswordOtpSent(false);
      setPasswordOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update password.",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white px-6 sm:px-12 lg:px-20 py-20">
        <p className="text-sm text-gray-600">Loading security settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 sm:px-12 lg:px-20 py-20">
      <button
        type="button"
        onClick={() => router.push("/profile")}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
      >
        <ArrowLeft size={16} />
        Back to Profile
      </button>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 text-emerald-700" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Security Settings</h1>
            <p className="mt-1 text-sm text-gray-600">
              Auth provider: {authProviderLabel}. Change your account email or password here.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : null}
        {success ? (
          <p className="mt-4 text-sm text-emerald-700">{success}</p>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmitEmailChange}
          className="rounded-2xl border border-gray-200 bg-white p-6"
        >
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-gray-700" />
            <h2 className="text-base font-semibold text-gray-900">Change Email</h2>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            Current email: <span className="font-medium">{me?.email || "Not available"}</span>
          </p>

          <label className="mt-4 block text-sm font-medium text-gray-700">New Email</label>
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            disabled={isLineAuthAccount || isSubmittingEmail}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-100"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isLineAuthAccount || isSubmittingEmail}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSubmittingEmail ? "Updating..." : "Change Email"}
            </button>

            <button
              type="button"
              onClick={handleRefreshEmailStatus}
              disabled={isRefreshingEmail}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isRefreshingEmail ? "Refreshing..." : "Refresh Email Status"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-gray-700" />
            <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            We use OTP verification before updating your password.
          </p>

          <label className="mt-4 block text-sm font-medium text-gray-700">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={isLineAuthAccount}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-100"
          />

          <label className="mt-4 block text-sm font-medium text-gray-700">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isLineAuthAccount}
            placeholder="Re-enter password"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-100"
          />

          <button
            type="button"
            onClick={handleOpenPasswordModal}
            disabled={isLineAuthAccount}
            className="mt-5 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Verify OTP and Change Password
          </button>
        </div>
      </div>

      {isPasswordModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Password OTP Verification</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Send OTP to your email, then confirm to update password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isSendingPasswordOtp || isUpdatingPassword) return;
                  setIsPasswordModalOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={handleSendPasswordOtp}
                disabled={isSendingPasswordOtp || isUpdatingPassword}
                className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
              >
                {isSendingPasswordOtp
                  ? "Sending..."
                  : passwordOtpSent
                    ? "Resend OTP"
                    : "Send OTP"}
              </button>

              <input
                type="text"
                value={passwordOtp}
                onChange={(event) => setPasswordOtp(normalizeOtpInput(event.target.value))}
                placeholder="6 digit OTP"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800"
              />

              <button
                type="button"
                onClick={handleConfirmPasswordUpdate}
                disabled={isUpdatingPassword || passwordOtp.length !== 6}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                {isUpdatingPassword ? "Updating..." : "Confirm OTP and Update Password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
