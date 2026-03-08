"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Edit, X, Save, LogOut } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiClientError,
  type CustomerTier,
  type UserMeResponse,
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
  signOutAndRedirect,
  updateUserMeProfile,
} from "@/lib/apiClient";
import { startLineOAuth } from "@/lib/lineAuth";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";

type Profile = {
  name: string;
  tierCode: CustomerTier | null;
  tierLabel: string;
  authProvider: string;
  email: string;
  phone: string;
  location: string;
  lineId: string;
  language: string;
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string;
  lineOfficialVerifiedAt: string;
  lineLoginEnabled: boolean;
  emailNotificationsEnabled: boolean;
  lineNotificationsEnabled: boolean;
};

const EMPTY_PROFILE: Profile = {
  name: "",
  tierCode: null,
  tierLabel: "N/A",
  authProvider: "SUPABASE",
  email: "",
  phone: "",
  location: "",
  lineId: "",
  language: "English",
  lineUserId: "",
  lineDisplayName: "",
  linePictureUrl: "",
  lineOfficialVerifiedAt: "",
  lineLoginEnabled: false,
  emailNotificationsEnabled: true,
  lineNotificationsEnabled: false,
};

const resolveTierLabel = (tier: CustomerTier | null) => {
  if (tier === "VIP") return "VIP";
  if (tier === "ULTRA_VIP") return "VVIP";
  if (tier === "REGULAR") return "Regular";
  return "N/A";
};

const mapUserToProfile = (me: UserMeResponse): Profile => ({
  name: me.displayName || "",
  tierCode: me.customerTier,
  tierLabel: resolveTierLabel(me.customerTier),
  authProvider: (me.authProvider || "SUPABASE").toUpperCase(),
  email: me.email || "",
  phone: me.phone || "",
  location: me.city || "",
  lineId: me.lineId || "",
  language: me.preferredLanguage || "English",
  lineUserId: me.lineUserId || "",
  lineDisplayName: me.lineDisplayName || "",
  linePictureUrl: me.linePictureUrl || "",
  lineOfficialVerifiedAt: me.lineOfficialVerifiedAt || "",
  lineLoginEnabled: me.lineLoginEnabled,
  emailNotificationsEnabled: me.emailNotificationsEnabled,
  lineNotificationsEnabled: me.lineNotificationsEnabled,
});

type ProfileTextField =
  | "name"
  | "email"
  | "phone"
  | "location"
  | "lineId"
  | "language"
  | "lineUserId"
  | "lineDisplayName"
  | "linePictureUrl";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<Profile>(EMPTY_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [isCustomerProfile, setIsCustomerProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isConnectingLine, setIsConnectingLine] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const lineConnected = searchParams.get("lineConnected") === "1";
    const lineConnectError = searchParams.get("lineConnectError");

    if (lineConnected) {
      setError("");
      setSuccess("LINE account connected successfully.");
      return;
    }

    if (lineConnectError) {
      setSuccess("");
      setError(lineConnectError);
    }
  }, [searchParams]);

  const handleChange = (key: ProfileTextField, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleToggle = (
    key:
      | "emailNotificationsEnabled"
      | "lineNotificationsEnabled"
      | "lineLoginEnabled",
    value: boolean,
  ) => {
    if (key === "lineLoginEnabled" && value && !profile.lineUserId) {
      setError("Connect a LINE account before enabling LINE login.");
      return;
    }

    if (
      key === "lineLoginEnabled" &&
      !value &&
      profile.authProvider === "LINE"
    ) {
      setError("LINE login cannot be disabled for LINE-authenticated accounts.");
      return;
    }

    if (
      key === "lineNotificationsEnabled" &&
      value &&
      (!profile.lineUserId || !profile.lineOfficialVerifiedAt)
    ) {
      setError(
        "Please verify LINE Official Account connection before enabling LINE notifications.",
      );
      return;
    }

    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleEdit = () => {
    setError("");
    setSuccess("");
    setOriginalProfile(profile);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setError("");
    setSuccess("");
    setProfile(originalProfile);
    setIsEditing(false);
  };

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
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
          router.replace("/login?returnTo=/profile");
          return;
        }

        const me = await getUserMe({
          accessToken: session.access_token,
        });

        if (!isActive) return;

        const nextProfile = mapUserToProfile(me);
        setProfile(nextProfile);
        setOriginalProfile(nextProfile);
        setIsCustomerProfile((me.role || "").toUpperCase() === "CUSTOMER");
      } catch (err) {
        if (isAccountAccessDeniedError(err)) {
          await forceLogoutToBlockedPage(
            err.payload ?? {
              message: err.message,
              code: err.code,
            },
          );
          return;
        }

        if (err instanceof ApiClientError && err.status === 401) {
          await signOutAndRedirect("/login");
          return;
        }

        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Unable to load profile.");
      } finally {
        if (isActive) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
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

      const updatedMe = await updateUserMeProfile({
        accessToken: session.access_token,
        payload: {
          displayName: profile.name || null,
          phone: profile.phone || null,
          lineId: profile.lineId || null,
          preferredLanguage: isCustomerProfile ? profile.language || null : undefined,
          city: isCustomerProfile ? profile.location || null : undefined,
          lineUserId: profile.lineUserId || null,
          lineDisplayName: profile.lineDisplayName || null,
          linePictureUrl: profile.linePictureUrl || null,
          lineLoginEnabled: profile.lineLoginEnabled,
          emailNotificationsEnabled: profile.emailNotificationsEnabled,
          lineNotificationsEnabled: profile.lineNotificationsEnabled,
        },
      });

      const nextProfile = mapUserToProfile(updatedMe);
      setProfile(nextProfile);
      setOriginalProfile(nextProfile);
      setIsCustomerProfile((updatedMe.role || "").toUpperCase() === "CUSTOMER");
      setSuccess("Profile updated.");
      setIsEditing(false);
    } catch (err) {
      if (isAccountAccessDeniedError(err)) {
        await forceLogoutToBlockedPage(
          err.payload ?? {
            message: err.message,
            code: err.code,
          },
        );
        return;
      }

      if (err instanceof ApiClientError && err.status === 401) {
        await signOutAndRedirect("/login");
        return;
      }

      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOutAndRedirect("/login");
    setIsLoggingOut(false);
  };

  const handleConnectLine = async () => {
    setError("");
    setSuccess("");
    setIsConnectingLine(true);

    try {
      await startLineOAuth({
        intent: "connect",
        returnTo: "/profile",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start LINE connection.",
      );
      setIsConnectingLine(false);
    }
  };

  const lineOfficialIsVerified = Boolean(
    profile.lineUserId && profile.lineOfficialVerifiedAt,
  );

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-white px-6 sm:px-12 lg:px-20 py-20">
        <p className="text-sm text-gray-600">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 sm:px-12 lg:px-20 py-20">
      {/* ================= HEADER ================= */}
      <div className="mt-6 flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        {/* LEFT SIDE */}
        <div className="flex gap-6 items-center">
          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
            <Image
              src="/images/naruto.jpg"
              alt="Profile"
              fill
              className="object-cover"
            />
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-lg font-semibold tracking-wide">
              {profile.name || "Unnamed User"}
            </h4>
            <p className="text-sm text-gray-500">{profile.tierLabel}</p>
          </div>
        </div>

        {/* RIGHT SIDE BUTTONS */}
        <div className="w-full md:w-auto">
          {!isEditing ? (
            <button
              onClick={handleEdit}
              className="w-full md:w-auto bg-blue-500 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest text-white hover:bg-blue-600 transition cursor-pointer"
            >
              <Edit size={16} />
              Edit
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button
                onClick={handleCancel}
                className="w-full sm:w-auto bg-gray-200 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest hover:bg-gray-300 transition cursor-pointer"
              >
                <X size={16} />
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-auto bg-emerald-600 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-5 text-sm text-emerald-700">{success}</p>}

      {/* ================= GRID ================= */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        {(
          [
            ["name", "Full Name"],
            ["email", "Email Address"],
            ["phone", "Phone Number"],
            ["location", "Location"],
            ["lineId", "LINE ID"],
            ["lineUserId", "LINE User ID"],
            ["lineDisplayName", "LINE Display Name"],
          ] as [ProfileTextField, string][]
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-600">{label}</label>
            <input
              type="text"
              value={profile[key]}
              readOnly={
                key === "email" || !isEditing || (key === "location" && !isCustomerProfile)
              }
              onChange={(e) => handleChange(key, e.target.value)}
              className={`border rounded-lg px-4 py-3 text-sm outline-none transition ${
                key === "email" || !isEditing || (key === "location" && !isCustomerProfile)
                  ? "border-gray-200 bg-gray-100 cursor-not-allowed"
                  : "border-gray-300 focus:border-blue-500 bg-white"
              }`}
            />
          </div>
        ))}

        {/* ===== LANGUAGE SELECT ===== */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-600">Language</label>

          <select
            disabled={!isEditing || !isCustomerProfile}
            value={profile.language}
            onChange={(e) => handleChange("language", e.target.value)}
            className={`border rounded-lg px-4 py-3 text-sm outline-none transition ${
              isEditing && isCustomerProfile
                ? "border-gray-300 focus:border-blue-500 bg-white"
                : "border-gray-200 bg-gray-100 cursor-not-allowed"
              }`}
          >
            <option value="English">English</option>
            <option value="Chinese">Chinese</option>
            <option value="Thai">Thai</option>
            <option value="Myanmar">Myanmar</option>
          </select>
        </div>

        <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            Notification Channels
          </h4>
          <p className="text-xs text-gray-600 mb-4">
            Email and LINE can both be enabled. To enable LINE notifications,
            connect LINE, add our LINE Official Account, and verify with OTP.
          </p>

          <p className="mb-3 text-xs text-gray-600">
            Account login provider: {profile.authProvider}
          </p>

          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={handleConnectLine}
              disabled={isConnectingLine}
              className="w-full sm:w-auto bg-green-600 py-2.5 px-4 rounded-lg text-sm tracking-wide text-white hover:bg-green-700 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isConnectingLine
                ? "Connecting LINE..."
                : profile.lineUserId
                  ? "Reconnect with LINE"
                  : "Connect with LINE"}
            </button>
            {profile.lineUserId && (
              <p className="text-xs text-gray-600">
                Connected LINE User ID: {profile.lineUserId}
              </p>
            )}
          </div>

          <p className="mb-4 text-xs text-gray-600">
            LINE Official verification:{" "}
            {lineOfficialIsVerified
              ? `Verified at ${new Date(profile.lineOfficialVerifiedAt).toLocaleString()}`
              : "Not verified yet. Connect with LINE to continue verification on a separate page."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.lineLoginEnabled}
                disabled={
                  !isEditing ||
                  !profile.lineUserId ||
                  profile.authProvider === "LINE"
                }
                onChange={(event) =>
                  handleToggle("lineLoginEnabled", event.target.checked)
                }
              />
              LINE Login
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.emailNotificationsEnabled}
                disabled={!isEditing}
                onChange={(event) =>
                  handleToggle("emailNotificationsEnabled", event.target.checked)
                }
              />
              Email Notifications
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.lineNotificationsEnabled}
                disabled={
                  !isEditing ||
                  !profile.lineUserId ||
                  (!lineOfficialIsVerified && !profile.lineNotificationsEnabled)
                }
                onChange={(event) =>
                  handleToggle("lineNotificationsEnabled", event.target.checked)
                }
              />
              LINE Notifications
            </label>
          </div>
        </div>
      </div>
      {/* ================= TIER INFORMATION ================= */}
      <div className="mt-16 bg-gray-50 border border-gray-200 rounded-2xl p-8">
        <h3 className="text-lg font-semibold mb-6">
          Membership Tiers & Benefits
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* REGULAR */}
          <div
            className={`p-6 rounded-xl border transition ${
              profile.tierCode === "REGULAR"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <h4 className="text-base font-semibold mb-2">Regular</h4>
            <p className="text-sm text-gray-500 mb-4">
              Default membership level.
            </p>
            <p className="text-sm">• No minimum spending required</p>
            <p className="text-sm">• Standard purchase access</p>
          </div>

          {/* VIP */}
          <div
            className={`p-6 rounded-xl border transition ${
              profile.tierCode === "VIP"
                ? "border-emerald-600 bg-emerald-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <h4 className="text-base font-semibold mb-2">VIP</h4>
            <p className="text-sm text-gray-500 mb-4">
              Spend over <span className="font-medium">$5,000</span> total
            </p>
            <p className="text-sm">• Priority customer support</p>
            <p className="text-sm">• Early access to new collections</p>
            <p className="text-sm">• Exclusive promotions</p>
          </div>

          {/* VVIP */}
          <div
            className={`p-6 rounded-xl border transition ${
              profile.tierCode === "ULTRA_VIP"
                ? "border-purple-600 bg-purple-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <h4 className="text-base font-semibold mb-2">VVIP</h4>
            <p className="text-sm text-gray-500 mb-4">
              Spend over <span className="font-medium">$20,000</span> total
            </p>
            <p className="text-sm">• Dedicated account manager</p>
            <p className="text-sm">• Private invitation events</p>
            <p className="text-sm">• Maximum loyalty rewards</p>
          </div>
        </div>
      </div>
      <div className="mt-10">
        <div className="mb-6 bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-gray-600 leading-relaxed tracking-wide">
            Are you sure you want to log out at this time? You will need to sign
            back in to manage your account, view your profile, or access member
            benefits.
          </p>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full md:w-auto bg-red-400 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm tracking-widest text-white hover:bg-red-500 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogOut size={16} />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
