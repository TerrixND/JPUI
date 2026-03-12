"use client";

import GoogleLocationAutocomplete from "@/components/ui/location/GoogleLocationAutocomplete";
import LocationMapDialog from "@/components/ui/location/LocationMapDialog";
import PhoneNumberField from "@/components/ui/PhoneNumberField";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Edit, X, Save, LogOut, Trash2, Shield, Mail, Phone, MapPin, Globe, MessageCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiClientError,
  type CustomerTier,
  type UserAccountDeletionOtpMethod,
  type UserMeResponse,
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
  startUserAccountDeletionOtpChallenge,
  signOutAndRedirect,
  updateUserMeProfile,
  verifyUserAccountDeletionOtpChallenge,
} from "@/lib/apiClient";
import {
  buildLocationLabel,
  createLocationSelectionFromValues,
  normalizeExactLocationRecord,
  normalizeStoredLocationSelection,
  type GoogleLocationSelection,
} from "@/lib/googleMaps";
import { startLineOAuth } from "@/lib/lineAuth";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";

type Profile = {
  role: string;
  isMainAdmin: boolean;
  name: string;
  tierCode: CustomerTier | null;
  tierLabel: string;
  identityLabel: string;
  authProvider: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  timezone: string;
  lineId: string;
  language: string;
  exactLocation: GoogleLocationSelection | null;
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string;
  lineOfficialVerifiedAt: string;
  lineLoginEnabled: boolean;
  lineLoginAvailable: boolean;
  emailNotificationsEnabled: boolean;
  lineNotificationsEnabled: boolean;
};

const EMPTY_PROFILE: Profile = {
  role: "",
  isMainAdmin: false,
  name: "",
  tierCode: null,
  tierLabel: "N/A",
  identityLabel: "N/A",
  authProvider: "SUPABASE",
  email: "",
  phone: "",
  city: "",
  country: "",
  timezone: "",
  lineId: "",
  language: "English",
  exactLocation: null,
  lineUserId: "",
  lineDisplayName: "",
  linePictureUrl: "",
  lineOfficialVerifiedAt: "",
  lineLoginEnabled: false,
  lineLoginAvailable: false,
  emailNotificationsEnabled: true,
  lineNotificationsEnabled: false,
};

const resolveTierLabel = (tier: CustomerTier | null) => {
  if (tier === "VIP") return "VIP";
  if (tier === "ULTRA_VIP") return "VVIP";
  if (tier === "REGULAR") return "Regular";
  return "N/A";
};

const resolvePrimaryBranchName = (me: UserMeResponse) => {
  const memberships = Array.isArray(me.branchMemberships) ? me.branchMemberships : [];

  const primaryBranch = memberships.find(
    (membership) => membership.isPrimary && membership.branch?.name,
  );
  if (primaryBranch?.branch?.name) {
    return primaryBranch.branch.name;
  }

  const anyBranch = memberships.find((membership) => membership.branch?.name);
  return anyBranch?.branch?.name || "";
};

const resolveManagerType = (me: UserMeResponse) => {
  const permissions =
    me.permissions && typeof me.permissions === "object" && !Array.isArray(me.permissions)
      ? (me.permissions as Record<string, unknown>)
      : null;
  const profile =
    permissions?.profile &&
    typeof permissions.profile === "object" &&
    !Array.isArray(permissions.profile)
      ? (permissions.profile as Record<string, unknown>)
      : null;
  const managerType = profile?.managerType;

  return typeof managerType === "string" ? managerType.trim().toUpperCase() : "";
};

const resolveIdentityLabel = (me: UserMeResponse) => {
  const role = String(me.role || "").trim().toUpperCase();

  if (role === "CUSTOMER") {
    return resolveTierLabel(me.customerTier);
  }

  if (role === "ADMIN") {
    return me.isMainAdmin ? "Main Admin" : "Admin";
  }

  if (role === "MANAGER") {
    const managerType = resolveManagerType(me);
    const branchName = resolvePrimaryBranchName(me);

    if (managerType === "STANDALONE") {
      return "Standalone Manager";
    }

    if (managerType === "BRANCH_ADMIN" || me.isBranchAdmin) {
      return branchName ? `Branch Admin (${branchName})` : "Branch Admin";
    }

    return branchName ? `Branch Manager (${branchName})` : "Branch Manager";
  }

  if (role === "SALES") {
    const branchName = resolvePrimaryBranchName(me);
    return branchName ? `Sales (${branchName})` : "Sales";
  }

  return "N/A";
};

const LINE_OFFICIAL_ACCOUNT_ADD_FRIEND_URL = "https://line.me/R/ti/p/%40404isuyx#~";

const normalizeOtpInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const mapUserToProfile = (me: UserMeResponse): Profile => ({
  role: (me.role || "").toUpperCase(),
  isMainAdmin: me.isMainAdmin === true,
  name: me.displayName || "",
  tierCode: me.customerTier,
  tierLabel: resolveTierLabel(me.customerTier),
  identityLabel: resolveIdentityLabel(me),
  authProvider: (me.authProvider || "SUPABASE").toUpperCase(),
  email: me.email || "",
  phone: me.phone || "",
  city: me.city || "",
  country: me.country || "",
  timezone: me.timezone || "",
  lineId: me.lineId || "",
  language: me.preferredLanguage || "English",
  exactLocation: normalizeExactLocationRecord(me.exactGeoLocation),
  lineUserId: me.lineUserId || "",
  lineDisplayName: me.lineDisplayName || "",
  linePictureUrl: me.linePictureUrl || "",
  lineOfficialVerifiedAt: me.lineOfficialVerifiedAt || "",
  lineLoginEnabled: me.lineLoginEnabled,
  lineLoginAvailable: me.lineLoginAvailable,
  emailNotificationsEnabled: me.emailNotificationsEnabled,
  lineNotificationsEnabled: me.lineNotificationsEnabled,
});

const asMetadataRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const resolveCustomerLocationSelection = ({
  profile,
  metadata,
}: {
  profile: Pick<Profile, "city" | "country" | "timezone">;
  metadata: unknown;
}) => {
  const metadataSelection = normalizeStoredLocationSelection(metadata);

  return createLocationSelectionFromValues({
    district: metadataSelection?.district || null,
    city: profile.city || metadataSelection?.city || "",
    country: profile.country || metadataSelection?.country || "",
    timezone: profile.timezone || metadataSelection?.timezone || "",
    formattedAddress: metadataSelection?.formattedAddress || null,
    placeId: metadataSelection?.placeId || null,
    label: metadataSelection?.label || "",
    source: metadataSelection?.source || "PROFILE",
  });
};

const buildCustomerLocationMetadataPayload = ({
  currentMetadata,
  selection,
  profile,
}: {
  currentMetadata: Record<string, unknown>;
  selection: GoogleLocationSelection | null;
  profile: Pick<Profile, "city" | "country" | "timezone">;
}) => ({
  ...currentMetadata,
  city: profile.city || null,
  country: profile.country || null,
  timezone: profile.timezone || null,
  district: selection?.district || null,
  locationLabel:
    buildLocationLabel(
      selection || {
        city: profile.city,
        country: profile.country,
      },
    ) || null,
});

type ProfileTextField =
  | "name"
  | "email"
  | "phone"
  | "lineId"
  | "language"
  | "lineUserId"
  | "lineDisplayName"
  | "linePictureUrl";

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const deleteModalRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<Profile>(EMPTY_PROFILE);
  const [customerLocationSelection, setCustomerLocationSelection] =
    useState<GoogleLocationSelection | null>(null);
  const [originalCustomerLocationSelection, setOriginalCustomerLocationSelection] =
    useState<GoogleLocationSelection | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCustomerProfile, setIsCustomerProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isConnectingLine, setIsConnectingLine] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteOtpMethod, setDeleteOtpMethod] = useState<UserAccountDeletionOtpMethod>("EMAIL");
  const [deleteOtpChallengeId, setDeleteOtpChallengeId] = useState("");
  const [deleteOtpCode, setDeleteOtpCode] = useState("");
  const [deleteOtpMaskedEmail, setDeleteOtpMaskedEmail] = useState("");
  const [deleteOtpAddOfficialUrl, setDeleteOtpAddOfficialUrl] = useState("");
  const [deleteOtpInfo, setDeleteOtpInfo] = useState("");
  const [deleteOtpError, setDeleteOtpError] = useState("");
  const [deleteOtpBusy, setDeleteOtpBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ── GSAP intro animations ── */
  useLayoutEffect(() => {
    if (isLoadingProfile) return;
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      /* hero header — elegant slide-up reveal */
      tl.fromTo(
        "[data-anim='hero-label']",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.6 },
        0.1,
      );

      tl.fromTo(
        "[data-anim='hero-name']",
        { autoAlpha: 0, y: 40, clipPath: "inset(0 0 100% 0)" },
        {
          autoAlpha: 1,
          y: 0,
          clipPath: "inset(0 0 0% 0)",
          duration: 0.9,
          ease: "expo.out",
          clearProps: "clipPath",
        },
        0.15,
      );

      tl.fromTo(
        "[data-anim='hero-sub']",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, clearProps: "transform,opacity" },
        0.4,
      );

      /* avatar card */
      tl.fromTo(
        "[data-anim='avatar']",
        { autoAlpha: 0, scale: 0.9 },
        { autoAlpha: 1, scale: 1, duration: 0.7, ease: "back.out(1.4)", clearProps: "transform,opacity" },
        0.3,
      );

      /* info pills */
      tl.fromTo(
        "[data-anim='info-pill']",
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, clearProps: "transform,opacity" },
        0.5,
      );

      /* action buttons */
      tl.fromTo(
        "[data-anim='action']",
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06, clearProps: "transform,opacity" },
        0.65,
      );

      /* scroll-triggered sections */
      gsap.utils.toArray<HTMLElement>("[data-anim='section']").forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 50 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      /* form fields stagger on scroll */
      const fields = gsap.utils.toArray<HTMLElement>("[data-anim='field']");
      if (fields.length) {
        gsap.fromTo(
          fields,
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.05,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: fields[0],
              start: "top 92%",
              toggleActions: "play none none none",
            },
          },
        );
      }

      /* tier cards */
      const tiers = gsap.utils.toArray<HTMLElement>("[data-anim='tier']");
      if (tiers.length) {
        gsap.fromTo(
          tiers,
          { autoAlpha: 0, y: 30, scale: 0.97 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: tiers[0],
              start: "top 88%",
              toggleActions: "play none none none",
            },
          },
        );
      }

      /* bottom cards */
      gsap.utils.toArray<HTMLElement>("[data-anim='bottom-card']").forEach((el, i) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 30, x: i % 2 === 0 ? -20 : 20 },
          {
            autoAlpha: 1,
            y: 0,
            x: 0,
            duration: 0.6,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    }, root);

    return () => ctx.revert();
  }, [isLoadingProfile]);

  /* ── Field interaction animations ── */
  useEffect(() => {
    if (isLoadingProfile) return;
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cleanups: Array<() => void> = [];

    const inputWraps = Array.from(
      root.querySelectorAll<HTMLElement>("[data-profile-input-wrap]"),
    );

    inputWraps.forEach((field) => {
      const input = field.querySelector<HTMLInputElement | HTMLSelectElement>(
        "input, select",
      );
      const activeLine =
        field.querySelector<HTMLElement>("[data-profile-active-line]");
      const label = field.querySelector<HTMLElement>("[data-profile-label]");

      if (!input || !activeLine || !label) return;

      const isLocked = () =>
        input.hasAttribute("readonly") || input.hasAttribute("disabled");

      const syncFieldState = () => {
        const value = "value" in input ? String(input.value || "").trim() : "";
        const hasValue = value.length > 0;
        const locked = isLocked();

        gsap.to(activeLine, {
          scaleX: hasValue ? 1 : 0,
          duration: hasValue ? 0.32 : 0.24,
          ease: "power2.out",
          overwrite: "auto",
        });
        gsap.to(label, {
          x: hasValue ? 4 : 0,
          color: hasValue ? (locked ? "#525252" : "#166534") : "#737373",
          duration: 0.32,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const handleFocus = () => {
        if (isLocked()) return;
        gsap.to(activeLine, { scaleX: 1, duration: 0.4, ease: "power3.out", overwrite: "auto" });
        gsap.to(label, { x: 4, color: "#166534", duration: 0.36, ease: "power2.out", overwrite: "auto" });
      };

      const handleBlur = () => syncFieldState();
      const handleInput = () => syncFieldState();

      syncFieldState();
      input.addEventListener("focus", handleFocus);
      input.addEventListener("blur", handleBlur);
      input.addEventListener("input", handleInput);
      input.addEventListener("change", handleInput);

      cleanups.push(() => {
        input.removeEventListener("focus", handleFocus);
        input.removeEventListener("blur", handleBlur);
        input.removeEventListener("input", handleInput);
        input.removeEventListener("change", handleInput);
      });
    });

    return () => cleanups.forEach((c) => c());
  }, [isLoadingProfile, isEditing]);

  /* ── Delete modal animation ── */
  useEffect(() => {
    const modal = deleteModalRef.current;
    if (!modal || !isDeleteModalOpen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const overlay = modal.parentElement;
    const pieces = modal.querySelectorAll("[data-delete-modal-piece]");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (overlay) {
      tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 });
    }

    tl.fromTo(
      modal,
      { autoAlpha: 0, y: 30, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, clearProps: "transform,opacity" },
      overlay ? "-=0.05" : 0,
    ).fromTo(
      pieces,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.04, clearProps: "transform,opacity" },
      "-=0.15",
    );
  }, [isDeleteModalOpen]);

  /* ── Data & search params ── */
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
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleCustomerLocationChange = (selection: GoogleLocationSelection | null) => {
    setCustomerLocationSelection(selection);
    setProfile((prev) => ({
      ...prev,
      city: selection?.city || "",
      country: selection?.country || "",
      timezone: selection ? selection.timezone || prev.timezone : "",
    }));
  };

  const handleExactLocationChange = (selection: GoogleLocationSelection | null) => {
    setProfile((prev) => ({
      ...prev,
      exactLocation: selection,
      timezone: selection ? selection.timezone || prev.timezone : prev.timezone,
    }));
  };

  const handleToggle = (
    key: "emailNotificationsEnabled" | "lineNotificationsEnabled" | "lineLoginEnabled",
    value: boolean,
  ) => {
    if (key === "lineLoginEnabled" && value && !profile.lineUserId) {
      setError("Connect a LINE account before enabling LINE login.");
      return;
    }
    if (key === "lineLoginEnabled" && value && !profile.lineLoginAvailable) {
      setError("LINE login is currently unavailable. Please login with email and password.");
      return;
    }
    if (key === "lineLoginEnabled" && !value && profile.authProvider === "LINE") {
      setError("LINE login cannot be disabled for LINE-authenticated accounts.");
      return;
    }
    if (
      key === "lineNotificationsEnabled" &&
      value &&
      (!profile.lineUserId || !profile.lineOfficialVerifiedAt)
    ) {
      setError("Please verify LINE Official Account connection before enabling LINE notifications.");
      return;
    }
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = () => {
    setError("");
    setSuccess("");
    setOriginalProfile(profile);
    setOriginalCustomerLocationSelection(customerLocationSelection);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setError("");
    setSuccess("");
    setProfile(originalProfile);
    setCustomerLocationSelection(originalCustomerLocationSelection);
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

        if (sessionError) throw new Error(sessionError.message);
        if (!session?.access_token) {
          router.replace("/login?returnTo=/profile");
          return;
        }

        const me = await getUserMe({ accessToken: session.access_token });

        if (!isActive) return;

        const nextProfile = mapUserToProfile(me);
        const nextIsCustomerProfile = (me.role || "").toUpperCase() === "CUSTOMER";
        const nextCustomerLocation = nextIsCustomerProfile
          ? resolveCustomerLocationSelection({
              profile: nextProfile,
              metadata: session.user.user_metadata,
            })
          : null;
        setProfile(nextProfile);
        setOriginalProfile(nextProfile);
        setCustomerLocationSelection(nextCustomerLocation);
        setOriginalCustomerLocationSelection(nextCustomerLocation);
        setIsCustomerProfile(nextIsCustomerProfile);
      } catch (err) {
        if (isAccountAccessDeniedError(err)) {
          await forceLogoutToBlockedPage(
            err.payload ?? { message: err.message, code: err.code },
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
        if (isActive) setIsLoadingProfile(false);
      }
    };

    void loadProfile();
    return () => { isActive = false; };
  }, [router]);

  const getSessionAccessTokenOrThrow = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session?.access_token) throw new Error("Your session has expired. Please login again.");
    return session.access_token;
  };

  const resetDeleteOtpState = (method: UserAccountDeletionOtpMethod) => {
    setDeleteOtpMethod(method);
    setDeleteOtpChallengeId("");
    setDeleteOtpCode("");
    setDeleteOtpMaskedEmail("");
    setDeleteOtpAddOfficialUrl("");
    setDeleteOtpInfo("");
    setDeleteOtpError("");
  };

  const handleOpenDeleteModal = () => {
    setError("");
    setSuccess("");
    resetDeleteOtpState("EMAIL");
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (deleteOtpBusy) return;
    setIsDeleteModalOpen(false);
  };

  const handleDeleteOtpMethodChange = (method: UserAccountDeletionOtpMethod) => {
    if (deleteOtpBusy) return;
    resetDeleteOtpState(method);
  };

  const handleSendDeleteOtp = async () => {
    setDeleteOtpError("");
    setDeleteOtpInfo("");
    setDeleteOtpBusy("send");

    try {
      const accessToken = await getSessionAccessTokenOrThrow();
      const response = await startUserAccountDeletionOtpChallenge({
        accessToken,
        method: deleteOtpMethod,
      });

      const nextChallengeId = response.challenge?.id || "";
      if (!nextChallengeId) throw new Error("Failed to start OTP challenge. Please try again.");

      setDeleteOtpChallengeId(nextChallengeId);
      setDeleteOtpMaskedEmail(response.challenge?.maskedEmail || "");
      setDeleteOtpAddOfficialUrl(response.addOfficialAccountUrl || "");
      setDeleteOtpInfo(response.message || "Verification code sent.");
    } catch (err) {
      if (isAccountAccessDeniedError(err)) {
        await forceLogoutToBlockedPage(err.payload ?? { message: err.message, code: err.code });
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        await signOutAndRedirect("/login");
        return;
      }
      setDeleteOtpError(err instanceof Error ? err.message : "Unable to send verification code.");
    } finally {
      setDeleteOtpBusy(null);
    }
  };

  const handleVerifyDeleteOtp = async () => {
    setDeleteOtpError("");
    setDeleteOtpInfo("");

    if (!deleteOtpChallengeId) {
      setDeleteOtpError("Send a verification code first.");
      return;
    }
    if (deleteOtpCode.length !== 6) {
      setDeleteOtpError("Enter a 6 digit code.");
      return;
    }

    setDeleteOtpBusy("verify");
    try {
      const accessToken = await getSessionAccessTokenOrThrow();
      const response = await verifyUserAccountDeletionOtpChallenge({
        accessToken,
        challengeId: deleteOtpChallengeId,
        otp: deleteOtpCode,
        method: deleteOtpMethod,
      });

      setDeleteOtpInfo(response.message || "Account deleted.");
      await signOutAndRedirect("/login?accountDeleted=1");
    } catch (err) {
      if (isAccountAccessDeniedError(err)) {
        await forceLogoutToBlockedPage(err.payload ?? { message: err.message, code: err.code });
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        await signOutAndRedirect("/login");
        return;
      }
      setDeleteOtpError(err instanceof Error ? err.message : "Unable to verify code.");
    } finally {
      setDeleteOtpBusy(null);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const accessToken = await getSessionAccessTokenOrThrow();

      const updatedMe = await updateUserMeProfile({
        accessToken,
        payload: {
          displayName: profile.name || null,
          phone: profile.phone || null,
          lineId: profile.lineId || null,
          preferredLanguage: isCustomerProfile ? profile.language || null : undefined,
          city: isCustomerProfile ? profile.city || null : undefined,
          country: isCustomerProfile ? profile.country || null : undefined,
          timezone: profile.timezone || null,
          exactGeoLocation:
            !isCustomerProfile && !profile.isMainAdmin
              ? (profile.exactLocation
                  ? {
                      placeId: profile.exactLocation.placeId,
                      formattedAddress: profile.exactLocation.formattedAddress,
                      district: profile.exactLocation.district,
                      city: profile.exactLocation.city,
                      country: profile.exactLocation.country,
                      timezone: profile.exactLocation.timezone,
                      latitude: profile.exactLocation.latitude,
                      longitude: profile.exactLocation.longitude,
                      label: profile.exactLocation.label,
                    }
                  : null)
              : undefined,
          lineUserId: profile.lineUserId || null,
          lineDisplayName: profile.lineDisplayName || null,
          linePictureUrl: profile.linePictureUrl || null,
          lineLoginEnabled: profile.lineLoginEnabled,
          emailNotificationsEnabled: profile.emailNotificationsEnabled,
          lineNotificationsEnabled: profile.lineNotificationsEnabled,
        },
      });

      const nextProfile = mapUserToProfile(updatedMe);
      const nextCustomerLocation = isCustomerProfile
        ? createLocationSelectionFromValues({
            district: customerLocationSelection?.district || null,
            city: nextProfile.city || "",
            country: nextProfile.country || "",
            timezone: nextProfile.timezone || "",
            formattedAddress: customerLocationSelection?.formattedAddress || null,
            placeId: customerLocationSelection?.placeId || null,
            label: customerLocationSelection?.label || "",
            source: customerLocationSelection?.source || "PROFILE",
          })
        : null;
      let nextSuccessMessage = "Profile updated.";

      if (isCustomerProfile) {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) {
          throw new Error(sessionError.message);
        }

        const { error: metadataError } = await supabase.auth.updateUser({
          data: buildCustomerLocationMetadataPayload({
            currentMetadata: asMetadataRecord(session?.user?.user_metadata),
            selection: nextCustomerLocation,
            profile: nextProfile,
          }),
        });

        if (metadataError) {
          nextSuccessMessage =
            "Profile updated. Sign out and back in if appointment location details still look stale.";
        }
      }

      setProfile(nextProfile);
      setOriginalProfile(nextProfile);
      setCustomerLocationSelection(nextCustomerLocation);
      setOriginalCustomerLocationSelection(nextCustomerLocation);
      setIsCustomerProfile((updatedMe.role || "").toUpperCase() === "CUSTOMER");
      setSuccess(nextSuccessMessage);
      setIsEditing(false);
    } catch (err) {
      if (isAccountAccessDeniedError(err)) {
        await forceLogoutToBlockedPage(err.payload ?? { message: err.message, code: err.code });
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
      await startLineOAuth({ intent: "connect", returnTo: "/profile" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start LINE connection.");
      setIsConnectingLine(false);
    }
  };

  /* ── Derived values ── */
  const lineOfficialIsVerified = Boolean(profile.lineUserId && profile.lineOfficialVerifiedAt);
  const resolvedDeleteOtpLineAddFriendUrl =
    deleteOtpAddOfficialUrl || LINE_OFFICIAL_ACCOUNT_ADD_FRIEND_URL;
  const avatarSrc = profile.linePictureUrl || "/images/naruto.jpg";
  const isRemoteAvatar = /^https?:\/\//i.test(avatarSrc);
  const locationLabel = buildLocationLabel(
    isCustomerProfile
      ? customerLocationSelection || {
          city: profile.city,
          country: profile.country,
        }
      : {
          city: profile.city,
          country: profile.country,
        },
  );
  const isStaffExactLocationEditable =
    !isCustomerProfile &&
    !profile.isMainAdmin &&
    (profile.role === "ADMIN" || profile.role === "MANAGER" || profile.role === "SALES");
  const canViewExactLocationMap =
    profile.exactLocation?.latitude !== null && profile.exactLocation?.longitude !== null;

  /* ── Loading state ── */
  if (isLoadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 pt-16">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-emerald-600" />
          <p className="text-sm tracking-wide text-neutral-400">Loading profile</p>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div ref={rootRef} className="min-h-screen bg-neutral-50 pt-16 text-neutral-900">

      {/* ─── Hero / Identity ─── */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-5 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-16">

          {/* top label */}
          <p
            data-anim="hero-label"
            className="mb-6 text-[11px] uppercase tracking-[0.3em] text-neutral-400"
          >
            {isCustomerProfile ? "Membership" : "Account"}
          </p>

          {/* avatar + name row */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            {/* avatar */}
            <div
              data-anim="avatar"
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-lg sm:h-24 sm:w-24"
            >
              <Image
                src={avatarSrc}
                alt="Profile"
                fill
                unoptimized={isRemoteAvatar}
                className="object-cover"
              />
            </div>

            {/* name + meta */}
            <div className="min-w-0 flex-1">
              <h1
                data-anim="hero-name"
                className="text-2xl font-medium tracking-tight text-neutral-900 sm:text-3xl"
              >
                {profile.name || "Unnamed User"}
              </h1>
              <div data-anim="hero-sub" className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {isCustomerProfile ? profile.tierLabel : profile.identityLabel}
                </span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500">
                  {profile.authProvider}
                </span>
                {profile.lineUserId && (
                  <span className={`rounded-full px-3 py-1 text-xs ${lineOfficialIsVerified ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                    {lineOfficialIsVerified ? "LINE Verified" : "LINE Pending"}
                  </span>
                )}
              </div>
              {profile.lineDisplayName && (
                <p data-anim="hero-sub" className="mt-2 text-sm text-neutral-400">
                  LINE: {profile.lineDisplayName}
                </p>
              )}
            </div>
          </div>

          {/* quick info pills */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Mail, label: "Email", value: profile.email || "Not set" },
              { icon: Phone, label: "Phone", value: profile.phone || "Not set" },
              { icon: MapPin, label: "Location", value: locationLabel || "Not set" },
            ].map((item) => (
              <div
                key={item.label}
                data-anim="info-pill"
                className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 px-4 py-3"
              >
                <item.icon size={16} className="shrink-0 text-neutral-400" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                  <p className="truncate text-sm text-neutral-700">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* action buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  data-anim="action"
                  onClick={() => router.push("/profile/security")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.98]"
                >
                  <Shield size={15} />
                  Security
                </button>
                <button
                  type="button"
                  data-anim="action"
                  onClick={handleEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 active:scale-[0.98]"
                >
                  <Edit size={15} />
                  Edit Profile
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-anim="action"
                  onClick={handleCancel}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.98]"
                >
                  <X size={15} />
                  Cancel
                </button>
                <button
                  type="button"
                  data-anim="action"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={15} />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>

          {/* notices */}
          {error && (
            <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}
        </div>
      </section>

      {/* ─── Main content ─── */}
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">

        {/* ── Personal Information ── */}
        <section data-anim="section" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-lg font-medium text-neutral-900">Personal Information</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Update your details across Jade Palace services.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {(
              [
                ["name", "Full Name"],
                ["email", "Email Address"],
                ["lineId", "LINE ID"],
                ["lineUserId", "LINE User ID"],
                ["lineDisplayName", "LINE Display Name"],
              ] as [ProfileTextField, string][]
            ).map(([key, label]) => {
              const isReadOnly = key === "email" || !isEditing;

              return (
                <div key={key} data-anim="field" data-profile-input-wrap className="relative">
                  <label
                    data-profile-label
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-400"
                  >
                    {label}
                  </label>
                  <input
                    type="text"
                    value={profile[key]}
                    readOnly={isReadOnly}
                    onChange={(event) => handleChange(key, event.target.value)}
                    className={`w-full border-b border-neutral-200 bg-transparent pb-3 text-[15px] text-neutral-800 outline-none transition-colors focus:border-emerald-600 ${
                      isReadOnly ? "cursor-not-allowed text-neutral-400" : ""
                    }`}
                  />
                  <div
                    data-profile-active-line
                    className={`absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 ${
                      isReadOnly ? "bg-neutral-300" : "bg-emerald-600"
                    }`}
                  />
                </div>
              );
            })}

            <div data-anim="field" className="relative">
              <PhoneNumberField
                label="Phone Number"
                value={profile.phone}
                onChange={(value) => handleChange("phone", value)}
                countryHint={profile.country}
                disabled={!isEditing}
                readOnly={!isEditing}
                placeholder="Local phone number"
                helperText="Country code is suggested from your saved location and can be changed while editing."
                variant="underline"
              />
            </div>

            <div data-anim="field" data-profile-input-wrap className="relative">
              <label
                data-profile-label
                className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-400"
              >
                Language
              </label>
              <select
                disabled={!isEditing || !isCustomerProfile}
                value={profile.language}
                onChange={(event) => handleChange("language", event.target.value)}
                className={`w-full border-b border-neutral-200 bg-transparent pb-3 text-[15px] text-neutral-800 outline-none transition-colors focus:border-emerald-600 ${
                  !isEditing || !isCustomerProfile ? "cursor-not-allowed text-neutral-400" : ""
                }`}
              >
                <option value="English">English</option>
                <option value="Chinese">Chinese</option>
                <option value="Thai">Thai</option>
                <option value="Myanmar">Myanmar</option>
              </select>
              <div
                data-profile-active-line
                className={`absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 ${
                  !isEditing || !isCustomerProfile ? "bg-neutral-300" : "bg-emerald-600"
                }`}
              />
            </div>
          </div>

          {isCustomerProfile ? (
            <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-neutral-900">Customer Location</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Update the city, country, and timezone stored on your account.
                  </p>
                </div>
                {profile.timezone ? (
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    {profile.timezone}
                  </span>
                ) : null}
              </div>

              <div className="mt-5">
                <GoogleLocationAutocomplete
                  label="Location"
                  value={customerLocationSelection}
                  onChange={handleCustomerLocationChange}
                  disabled={!isEditing}
                  helperText="Only city, country, and timezone are persisted for customers."
                  mode="city"
                />
              </div>
            </div>
          ) : null}

          {isStaffExactLocationEditable ? (
            <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-neutral-900">Exact Staff Location</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Main admin can review this on the new staff map. Use current location to keep
                    the map accurate.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLocationDialogOpen(true)}
                  disabled={!canViewExactLocationMap}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Location Button
                </button>
              </div>

              <div className="mt-5">
                <GoogleLocationAutocomplete
                  label="Exact Location"
                  value={profile.exactLocation}
                  onChange={handleExactLocationChange}
                  disabled={!isEditing}
                  helperText="Stores precise coordinates, formatted address, and timezone for internal staff operations."
                  mode="address"
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* ── LINE & Notifications ── */}
        <section data-anim="section" className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <MessageCircle size={18} className="text-emerald-600" />
            <h2 className="text-lg font-medium text-neutral-900">LINE & Notifications</h2>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Connect LINE and manage notification preferences.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleConnectLine}
              disabled={isConnectingLine}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnectingLine
                ? "Connecting..."
                : profile.lineUserId
                  ? "Reconnect LINE"
                  : "Connect LINE"}
            </button>
            {profile.lineUserId && (
              <p className="text-sm text-neutral-400">
                Connected: {profile.lineUserId}
              </p>
            )}
          </div>

          {/* verification status */}
          <div className="mt-5 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Official Verification
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {lineOfficialIsVerified
                ? `Verified at ${new Date(profile.lineOfficialVerifiedAt).toLocaleString()}`
                : "Not verified yet. Connect with LINE to begin verification."}
            </p>
          </div>

          {/* notification toggles */}
          <div className="mt-5 space-y-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-100 px-4 py-3.5 transition-colors hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={profile.emailNotificationsEnabled}
                disabled={!isEditing}
                onChange={(event) =>
                  handleToggle("emailNotificationsEnabled", event.target.checked)
                }
                className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
              />
              <span className="text-sm text-neutral-700">Email Notifications</span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-100 px-4 py-3.5 transition-colors hover:bg-neutral-50">
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
                className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
              />
              <span className="text-sm text-neutral-700">LINE Notifications</span>
            </label>
          </div>
        </section>

        {/* ── Membership Tiers (customers only show active, staff see all) ── */}
        <section data-anim="section" className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-emerald-600" />
            <h2 className="text-lg font-medium text-neutral-900">Tiers & Benefits</h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                key: "REGULAR" as const,
                label: "Regular",
                desc: "Default membership level",
                perks: ["Assigned automatically", "Upgrade after verification"],
                active: profile.tierCode === "REGULAR",
                ring: "ring-neutral-900",
                bg: "bg-neutral-50",
              },
              {
                key: "VIP" as const,
                label: "VIP",
                desc: "Verified identity required",
                perks: ["Verified phone or LINE", "VIP targeting & priority"],
                active: profile.tierCode === "VIP",
                ring: "ring-emerald-600",
                bg: "bg-emerald-50",
              },
              {
                key: "ULTRA_VIP" as const,
                label: "VVIP",
                desc: "Highest customer tier",
                perks: ["VIP eligibility required", "1+ purchase or owned product"],
                active: profile.tierCode === "ULTRA_VIP",
                ring: "ring-amber-500",
                bg: "bg-amber-50",
              },
            ].map((tier) => (
              <div
                key={tier.key}
                data-anim="tier"
                className={`rounded-xl border p-5 transition-shadow ${
                  tier.active
                    ? `${tier.bg} ring-2 ${tier.ring} border-transparent shadow-md`
                    : "border-neutral-150 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-neutral-800">{tier.label}</h4>
                  {tier.active && (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-500">{tier.desc}</p>
                <ul className="mt-3 space-y-1">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="text-xs text-neutral-600">
                      <span className="mr-1.5 text-neutral-300">&bull;</span>
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Danger Zone ── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div
            data-anim="bottom-card"
            className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm"
          >
            <h4 className="text-sm font-semibold text-red-700">Delete Account</h4>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Permanently delete your account. Requires OTP verification via Email or LINE.
            </p>
            <button
              type="button"
              onClick={handleOpenDeleteModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-[0.98]"
            >
              <Trash2 size={14} />
              Delete Account
            </button>
          </div>

          <div
            data-anim="bottom-card"
            className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm leading-relaxed text-neutral-500">
              Done managing your account? Sign out to keep things secure.
            </p>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={14} />
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>

      <LocationMapDialog
        open={isLocationDialogOpen}
        title={profile.name || "Staff Location"}
        subtitle={profile.exactLocation?.label || "Current exact location on file."}
        markers={
          profile.exactLocation
            ? [
                {
                  id: profile.lineUserId || profile.email || profile.name || "profile-location",
                  title: profile.name || "Staff member",
                  subtitle: profile.exactLocation.label,
                  location: profile.exactLocation,
                },
              ]
            : []
        }
        onClose={() => setIsLocationDialogOpen(false)}
      />

      {/* ─── Delete Modal ─── */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            ref={deleteModalRef}
            className="w-full max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <div data-delete-modal-piece className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-lg font-medium text-neutral-900">Delete Account</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Verify with OTP to permanently delete your account.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleteOtpBusy !== null}
                className="rounded-lg border border-neutral-200 p-2 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div data-delete-modal-piece className="grid grid-cols-2 gap-2">
                {(["EMAIL", "LINE"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => handleDeleteOtpMethodChange(method)}
                    disabled={deleteOtpBusy !== null}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      deleteOtpMethod === method
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {method} OTP
                  </button>
                ))}
              </div>

              <div data-delete-modal-piece className="rounded-xl bg-neutral-50 p-4">
                {deleteOtpMethod === "EMAIL" ? (
                  <p className="text-sm text-neutral-600">
                    Send a 6-digit OTP to your email
                    {deleteOtpMaskedEmail ? ` (${deleteOtpMaskedEmail})` : ""}.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-neutral-600">
                      Send a 6-digit OTP to your connected LINE account.
                    </p>
                    <a
                      href={resolvedDeleteOtpLineAddFriendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-sm font-medium text-emerald-600 hover:underline"
                    >
                      Add LINE Official Account
                    </a>
                  </div>
                )}
              </div>

              <div data-delete-modal-piece className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleSendDeleteOtp()}
                  disabled={deleteOtpBusy !== null}
                  className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {deleteOtpBusy === "send"
                    ? "Sending..."
                    : deleteOtpChallengeId
                      ? "Resend Code"
                      : "Send Code"}
                </button>
                <input
                  type="text"
                  value={deleteOtpCode}
                  onChange={(event) => setDeleteOtpCode(normalizeOtpInput(event.target.value))}
                  placeholder="6-digit code"
                  className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
              </div>

              <button
                data-delete-modal-piece
                type="button"
                onClick={() => void handleVerifyDeleteOtp()}
                disabled={
                  deleteOtpBusy !== null || deleteOtpCode.length !== 6 || !deleteOtpChallengeId
                }
                className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteOtpBusy === "verify" ? "Verifying..." : "Verify & Delete Account"}
              </button>

              {deleteOtpError && (
                <div data-delete-modal-piece className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {deleteOtpError}
                </div>
              )}

              {deleteOtpInfo && (
                <div data-delete-modal-piece className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {deleteOtpInfo}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ProfilePageContent />
    </Suspense>
  );
}
