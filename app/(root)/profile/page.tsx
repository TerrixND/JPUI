"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Edit, X, Save, LogOut, Trash2, Shield } from "lucide-react";
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
import { startLineOAuth } from "@/lib/lineAuth";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";

type Profile = {
  name: string;
  tierCode: CustomerTier | null;
  tierLabel: string;
  identityLabel: string;
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
  lineLoginAvailable: boolean;
  emailNotificationsEnabled: boolean;
  lineNotificationsEnabled: boolean;
};

const EMPTY_PROFILE: Profile = {
  name: "",
  tierCode: null,
  tierLabel: "N/A",
  identityLabel: "N/A",
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
  name: me.displayName || "",
  tierCode: me.customerTier,
  tierLabel: resolveTierLabel(me.customerTier),
  identityLabel: resolveIdentityLabel(me),
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
  lineLoginAvailable: me.lineLoginAvailable,
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const deleteModalRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<Profile>(EMPTY_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [isCustomerProfile, setIsCustomerProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isConnectingLine, setIsConnectingLine] = useState(false);
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

  useLayoutEffect(() => {
    if (isLoadingProfile) {
      return;
    }

    const root = rootRef.current;

    if (!root) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    const cleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      const shell = root.querySelector<HTMLElement>("[data-profile-shell]");
      const hero = root.querySelector<HTMLElement>("[data-profile-hero]");
      const mainCard = root.querySelector<HTMLElement>("[data-profile-card]");
      const cardGlow = root.querySelector<HTMLElement>("[data-profile-glow]");
      const railCards = gsap.utils.toArray<HTMLElement>("[data-profile-rail-card]");
      const statusCards =
        gsap.utils.toArray<HTMLElement>("[data-profile-status-card]");
      const cardBlocks = gsap.utils.toArray<HTMLElement>("[data-profile-card-block]");
      const actions = gsap.utils.toArray<HTMLElement>("[data-profile-action]");
      const notices = gsap.utils.toArray<HTMLElement>("[data-profile-notice]");

      if (mainCard) {
        gsap.set(mainCard, {
          transformPerspective: 1600,
          transformStyle: "preserve-3d",
        });
      }

      const introTimeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      if (shell) {
        introTimeline.fromTo(
          "[data-profile-frame]",
          {
            autoAlpha: 0,
            scaleX: 0,
            transformOrigin: "left center",
          },
          {
            autoAlpha: 1,
            scaleX: 1,
            duration: 1.05,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0,
        );

        introTimeline.fromTo(
          "[data-profile-orbit]",
          {
            autoAlpha: 0,
            scale: 0.76,
            xPercent: -8,
            yPercent: 10,
          },
          {
            autoAlpha: 1,
            scale: 1,
            xPercent: 0,
            yPercent: 0,
            duration: 1.2,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0.04,
        );
      }

      if (hero) {
        introTimeline.fromTo(
          hero.querySelectorAll("[data-profile-heading-row]"),
          {
            autoAlpha: 0,
            y: 38,
            skewY: 4,
            clipPath: "inset(0 0 100% 0)",
          },
          {
            autoAlpha: 1,
            y: 0,
            skewY: 0,
            clipPath: "inset(0 0 0% 0)",
            duration: 1,
            stagger: 0.13,
            ease: "expo.out",
            clearProps: "transform,opacity,clipPath",
          },
          0.16,
        );

        introTimeline.fromTo(
          hero.querySelectorAll("[data-profile-copy]"),
          {
            autoAlpha: 0,
            y: 24,
            letterSpacing: "0.06em",
            filter: "blur(10px)",
          },
          {
            autoAlpha: 1,
            y: 0,
            letterSpacing: "0em",
            filter: "blur(0px)",
            duration: 0.82,
            stagger: 0.1,
            clearProps: "transform,opacity,filter,letterSpacing",
          },
          0.44,
        );

        introTimeline.fromTo(
          hero.querySelectorAll("[data-profile-detail]"),
          {
            autoAlpha: 0,
            y: 18,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0.56,
        );

        introTimeline.fromTo(
          hero.querySelectorAll("[data-profile-hero-piece]"),
          {
            autoAlpha: 0,
            y: 28,
            scale: 0.985,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.72,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0.58,
        );
      }

      if (railCards.length) {
        introTimeline.fromTo(
          railCards,
          {
            autoAlpha: 0,
            y: 22,
            scale: 0.985,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.66,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0.6,
        );
      }

      if (mainCard) {
        introTimeline.fromTo(
          mainCard,
          {
            autoAlpha: 0,
            y: 72,
            rotateX: 11,
            clipPath: "inset(10% 6% 18% 6% round 36px)",
            boxShadow: "0 0 0 rgba(0,0,0,0)",
          },
          {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            clipPath: "inset(0% 0% 0% 0% round 36px)",
            boxShadow: "0 42px 120px rgba(17, 24, 39, 0.12)",
            duration: 1.25,
            ease: "expo.out",
            clearProps: "transform,opacity,clipPath,boxShadow",
          },
          0.24,
        );
      }

      if (statusCards.length) {
        introTimeline.fromTo(
          statusCards,
          {
            autoAlpha: 0,
            y: 22,
            scale: 0.98,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.58,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          0.72,
        );
      }

      if (cardBlocks.length) {
        introTimeline.fromTo(
          cardBlocks,
          {
            autoAlpha: 0,
            y: 24,
            filter: "blur(10px)",
          },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.68,
            stagger: 0.08,
            clearProps: "transform,opacity,filter",
          },
          0.82,
        );
      }

      if (actions.length) {
        introTimeline.fromTo(
          actions,
          {
            autoAlpha: 0,
            y: 18,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.06,
            clearProps: "transform,opacity",
          },
          0.98,
        );
      }

      if (notices.length) {
        introTimeline.fromTo(
          notices,
          {
            autoAlpha: 0,
            y: 14,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.06,
            clearProps: "transform,opacity",
          },
          0.94,
        );
      }

      if (mainCard && cardGlow) {
        const rotateXTo = gsap.quickTo(mainCard, "rotateX", {
          duration: 0.6,
          ease: "power3.out",
        });
        const rotateYTo = gsap.quickTo(mainCard, "rotateY", {
          duration: 0.6,
          ease: "power3.out",
        });
        const glowXTo = gsap.quickTo(cardGlow, "x", {
          duration: 0.8,
          ease: "power3.out",
        });
        const glowYTo = gsap.quickTo(cardGlow, "y", {
          duration: 0.8,
          ease: "power3.out",
        });

        const handlePointerMove = (event: PointerEvent) => {
          const rect = mainCard.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;

          rotateXTo(-y * 4.5);
          rotateYTo(x * 5.5);
          glowXTo(x * 34);
          glowYTo(y * 24);
        };

        const handlePointerLeave = () => {
          rotateXTo(0);
          rotateYTo(0);
          glowXTo(0);
          glowYTo(0);
        };

        mainCard.addEventListener("pointermove", handlePointerMove);
        mainCard.addEventListener("pointerleave", handlePointerLeave);
        cleanups.push(() => {
          mainCard.removeEventListener("pointermove", handlePointerMove);
          mainCard.removeEventListener("pointerleave", handlePointerLeave);
        });
      }

      gsap.utils
        .toArray<HTMLElement>("[data-profile-orbit]")
        .forEach((orbit, index) => {
          gsap.to(orbit, {
            xPercent: index % 2 === 0 ? 5 : -4,
            yPercent: index % 2 === 0 ? -6 : 6,
            rotate: index % 2 === 0 ? 8 : -10,
            duration: 6.5 + index,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });

      const panels = gsap.utils.toArray<HTMLElement>("[data-profile-panel]");
      panels.forEach((panel, index) => {
        gsap.fromTo(
          panel,
          {
            autoAlpha: 0,
            y: 40,
            clipPath: "inset(12% 0 0 0)",
          },
          {
            autoAlpha: 1,
            y: 0,
            clipPath: "inset(0% 0 0 0)",
            duration: 0.84,
            ease: "power3.out",
            clearProps: "transform,opacity,clipPath",
            scrollTrigger: {
              trigger: panel,
              start: index === 0 ? "top 92%" : "top 88%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      const fields = gsap.utils.toArray<HTMLElement>("[data-profile-field]");
      fields.forEach((field, index) => {
        gsap.fromTo(
          field,
          {
            autoAlpha: 0,
            x: index % 2 === 0 ? -18 : 18,
            y: 18,
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            duration: 0.5,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: field,
              start: "top 92%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      const tierCards = gsap.utils.toArray<HTMLElement>("[data-profile-tier]");
      if (tierCards.length) {
        gsap.fromTo(
          tierCards,
          {
            autoAlpha: 0,
            y: 28,
            scale: 0.985,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.58,
            stagger: 0.08,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: tierCards[0]?.parentElement || tierCards[0],
              start: "top 88%",
              toggleActions: "play none none none",
            },
          },
        );
      }

      const dangerCards = gsap.utils.toArray<HTMLElement>("[data-profile-danger]");
      dangerCards.forEach((card, index) => {
        gsap.fromTo(
          card,
          {
            autoAlpha: 0,
            x: index % 2 === 0 ? -20 : 20,
            y: 20,
            scale: 0.99,
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.56,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: card,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    }, root);

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      ctx.revert();
    };
  }, [isLoadingProfile]);

  useEffect(() => {
    if (isLoadingProfile) {
      return;
    }

    const root = rootRef.current;

    if (!root) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const cleanups: Array<() => void> = [];
    const hoverEnabled = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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

      if (!input || !activeLine || !label) {
        return;
      }

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
          x: hasValue ? 6 : 0,
          color: hasValue
            ? locked
              ? "#525252"
              : "#166534"
            : "#737373",
          duration: 0.32,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const handleFocus = () => {
        if (isLocked()) {
          return;
        }

        gsap.to(activeLine, {
          scaleX: 1,
          duration: 0.4,
          ease: "power3.out",
          overwrite: "auto",
        });
        gsap.to(label, {
          x: 6,
          color: "#166534",
          duration: 0.36,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const handleBlur = () => {
        syncFieldState();
      };

      const handleInput = () => {
        syncFieldState();
      };

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

    if (!hoverEnabled) {
      return () => {
        cleanups.forEach((cleanup) => cleanup());
      };
    }

    const pressables = Array.from(
      root.querySelectorAll<HTMLElement>("[data-profile-pressable]"),
    );

    pressables.forEach((item) => {
      const handleEnter = () => {
        gsap.to(item, {
          y: -4,
          scale: 1.01,
          duration: 0.32,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const handleLeave = () => {
        gsap.to(item, {
          y: 0,
          scale: 1,
          duration: 0.36,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      item.addEventListener("pointerenter", handleEnter);
      item.addEventListener("pointerleave", handleLeave);

      cleanups.push(() => {
        item.removeEventListener("pointerenter", handleEnter);
        item.removeEventListener("pointerleave", handleLeave);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [isLoadingProfile, isEditing]);

  useEffect(() => {
    const modal = deleteModalRef.current;

    if (!modal || !isDeleteModalOpen) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const overlay = modal.parentElement;
    const body = modal.querySelectorAll("[data-delete-modal-piece]");

    gsap.set(modal, {
      transformOrigin: "center top",
    });

    const timeline = gsap.timeline({
      defaults: {
        ease: "power3.out",
      },
    });

    if (overlay) {
      timeline.fromTo(
        overlay,
        {
          autoAlpha: 0,
        },
        {
          autoAlpha: 1,
          duration: 0.18,
        },
      );
    }

    timeline
      .fromTo(
        modal,
        {
          autoAlpha: 0,
          y: 28,
          scale: 0.985,
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.34,
          clearProps: "transform,opacity",
        },
        overlay ? "-=0.02" : 0,
      )
      .fromTo(
        body,
        {
          autoAlpha: 0,
          y: 12,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.24,
          stagger: 0.04,
          clearProps: "transform,opacity",
        },
        "-=0.18",
      );
  }, [isDeleteModalOpen]);

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

    if (key === "lineLoginEnabled" && value && !profile.lineLoginAvailable) {
      setError("LINE login is currently unavailable. Please login with email and password.");
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
    if (deleteOtpBusy) {
      return;
    }
    setIsDeleteModalOpen(false);
  };

  const handleDeleteOtpMethodChange = (method: UserAccountDeletionOtpMethod) => {
    if (deleteOtpBusy) {
      return;
    }
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
      if (!nextChallengeId) {
        throw new Error("Failed to start OTP challenge. Please try again.");
      }

      setDeleteOtpChallengeId(nextChallengeId);
      setDeleteOtpMaskedEmail(response.challenge?.maskedEmail || "");
      setDeleteOtpAddOfficialUrl(response.addOfficialAccountUrl || "");
      setDeleteOtpInfo(response.message || "Verification code sent.");
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

      setDeleteOtpError(
        err instanceof Error ? err.message : "Unable to send verification code.",
      );
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

      setDeleteOtpError(
        err instanceof Error ? err.message : "Unable to verify code.",
      );
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
  const resolvedDeleteOtpLineAddFriendUrl =
    deleteOtpAddOfficialUrl || LINE_OFFICIAL_ACCOUNT_ADD_FRIEND_URL;
  const avatarSrc = profile.linePictureUrl || "/images/naruto.jpg";
  const isRemoteAvatar = /^https?:\/\//i.test(avatarSrc);
  const profileDetailTiles = [
    {
      label: "Email",
      value: profile.email || "No email address on file",
    },
    {
      label: "Phone",
      value: profile.phone || "No phone number on file",
    },
    {
      label: "Location",
      value: profile.location || "Location not provided",
    },
  ];
  const profileIdentityTiles = [
    {
      label: "Preferred Language",
      value: profile.language || "English",
    },
    {
      label: "Notification Status",
      value:
        profile.emailNotificationsEnabled || profile.lineNotificationsEnabled
          ? "Enabled"
          : "Disabled",
    },
  ];

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-[#f6f5f1] px-6 py-20 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl border border-black/8 bg-white/90 px-8 py-14 shadow-[0_22px_70px_rgba(15,23,42,0.05)]">
          <p className="text-sm uppercase tracking-[0.28em] text-neutral-500">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen overflow-hidden bg-[#f8f7f3] text-neutral-900"
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          data-profile-frame
          className="absolute left-0 top-0 h-px w-full bg-neutral-300/70"
        />
        <div
          data-profile-frame
          className="absolute bottom-0 left-0 h-px w-full bg-neutral-300/70"
        />
        <div
          data-profile-frame
          className="absolute left-6 top-0 hidden h-full w-px bg-neutral-200/80 sm:block"
        />
        <div
          data-profile-frame
          className="absolute right-6 top-0 hidden h-full w-px bg-neutral-200/80 sm:block"
        />
        <div
          data-profile-orbit
          className="absolute left-[-8rem] top-20 h-72 w-72 rounded-full border border-emerald-300/40 bg-emerald-200/15 blur-sm"
        />
        <div
          data-profile-orbit
          className="absolute right-[-5rem] top-28 h-52 w-52 rounded-full border border-neutral-300/60"
        />
        <div
          data-profile-orbit
          className="absolute bottom-[-7rem] left-[22%] h-64 w-64 rounded-full border border-amber-200/70 bg-amber-100/30 blur-2xl"
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(17,24,39,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,24,39,0.16) 1px, transparent 1px)",
            backgroundSize: "120px 120px",
          }}
        />
      </div>

      <div
        data-profile-shell
        className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      >
        <div
          data-profile-hero
          className="flex flex-col gap-10 lg:gap-12"
        >
          <div className="w-full">
            <p
              data-profile-copy
              className="mb-6 text-xs uppercase tracking-[0.42em] text-neutral-500"
            >
              Profile
            </p>

            <div className="space-y-2">
              <div className="overflow-hidden">
                <h1
                  data-profile-heading-row
                  className="text-5xl font-light leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl"
                >
                  Your
                </h1>
              </div>
              <div className="overflow-hidden">
                <h1
                  data-profile-heading-row
                  className="text-5xl font-light leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl"
                >
                  Jade Palace
                </h1>
              </div>
              <div className="overflow-hidden">
                <h1
                  data-profile-heading-row
                  className="text-5xl font-light leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl"
                >
                  {isCustomerProfile ? "Membership." : "Account."}
                </h1>
              </div>
            </div>

            <p
              data-profile-copy
              className="mt-8 max-w-3xl text-lg leading-relaxed text-neutral-600"
            >
              Manage your personal details, connected services, and security
              settings in one refined space. Everything remains private,
              deliberate, and easy to control.
            </p>

            <div
              data-profile-hero-piece
              data-profile-rail-card
              className="mt-10 w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/70 bg-white/84 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-7"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-[24px] border border-white/60 bg-neutral-200 shadow-[0_18px_40px_rgba(15,23,42,0.12)] md:h-28 md:w-28">
                  <Image
                    src={avatarSrc}
                    alt="Profile"
                    fill
                    unoptimized={isRemoteAvatar}
                    className="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                      Account Identity
                    </p>
                    <h2 className="mt-3 text-3xl font-light tracking-[-0.04em] text-neutral-950">
                      {profile.name || "Unnamed User"}
                    </h2>
                    <p className="mt-3 text-sm text-neutral-500">
                      {isCustomerProfile
                        ? `Tier: ${profile.tierLabel}`
                        : `Role: ${profile.identityLabel}`}
                    </p>
                    {profile.lineDisplayName ? (
                      <p className="mt-2 text-sm text-neutral-500">
                        LINE display name: {profile.lineDisplayName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.26em] text-neutral-500">
                    <span className="border border-neutral-200 bg-white/75 px-3 py-2">
                      {profile.authProvider}
                    </span>
                    <span className="border border-neutral-200 bg-white/75 px-3 py-2">
                      {lineOfficialIsVerified ? "LINE Verified" : "LINE Pending"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 max-w-3xl space-y-5">
              <div data-profile-detail className="flex items-center gap-4">
                <span className="h-px w-10 bg-neutral-400" />
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                  Account Details
                </p>
              </div>
              <div className="space-y-2 text-neutral-700">
                {profileDetailTiles.map((item) => (
                  <p key={item.label} data-profile-detail className="text-base">
                    {item.value}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
              {profileIdentityTiles.map((item) => (
                <div
                  key={item.label}
                  data-profile-hero-piece
                  data-profile-rail-card
                  className="rounded-[24px] border border-neutral-200/80 bg-[#fcfcf9] px-4 py-5"
                >
                  <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">
                    {item.label}
                  </p>
                  <p className="mt-3 text-lg text-neutral-950">{item.value}</p>
                </div>
              ))}
            </div>

            {error ? (
              <div
                data-profile-notice
                className="mt-8 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}
            {success ? (
              <div
                data-profile-notice
                className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                {success}
              </div>
            ) : null}

            <div
              data-profile-hero-piece
              data-profile-rail-card
              className="mt-8 w-full max-w-3xl rounded-[30px] border border-white/70 bg-white/82 p-5 shadow-[0_22px_65px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
              <div data-profile-detail className="flex items-center gap-4">
                <span className="h-px w-10 bg-neutral-400" />
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                  Account Controls
                </p>
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-600">
                Move between secure account management and profile editing
                without leaving the same space.
              </p>

              {!isEditing ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    data-profile-action
                    data-profile-pressable
                    onClick={() => router.push("/profile/security")}
                    className="inline-flex w-full items-center justify-center gap-2 border border-neutral-300 bg-white px-5 py-3 text-sm uppercase tracking-[0.24em] text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950 sm:w-auto"
                  >
                    <Shield size={16} />
                    Security
                  </button>
                  <button
                    type="button"
                    data-profile-action
                    data-profile-pressable
                    onClick={handleEdit}
                    className="inline-flex w-full items-center justify-center gap-2 bg-neutral-950 px-5 py-3 text-sm uppercase tracking-[0.24em] text-white transition hover:bg-neutral-800 sm:w-auto"
                  >
                    <Edit size={16} />
                    Edit Profile
                  </button>
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    data-profile-action
                    data-profile-pressable
                    onClick={handleCancel}
                    className="inline-flex w-full items-center justify-center gap-2 border border-neutral-300 bg-white px-5 py-3 text-sm uppercase tracking-[0.24em] text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950 sm:w-auto"
                  >
                    <X size={16} />
                    Cancel
                  </button>

                  <button
                    type="button"
                    data-profile-action
                    data-profile-pressable
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-2 bg-emerald-700 px-5 py-3 text-sm uppercase tracking-[0.24em] text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <Save size={16} />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>
 

          <div className="w-full">
            <div
              data-profile-card
              data-profile-panel
              className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/75 bg-white/84 p-6 shadow-[0_40px_110px_rgba(15,23,42,0.1)] backdrop-blur-xl sm:p-8 lg:p-10"
            >
              <div
                data-profile-glow
                className="pointer-events-none absolute left-1/2 top-12 h-44 w-44 -translate-x-1/2 rounded-full bg-emerald-100/75 blur-3xl"
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-tr-[56px] border-r border-t border-neutral-200/80" />

              <div className="relative space-y-10">
                <div data-profile-card-block>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                    Account Details
                  </p>
                  <h2 className="mt-2 text-3xl font-light tracking-[-0.03em] text-neutral-950">
                    Personal information
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">
                    Update your core profile information and keep your account
                    details aligned across Jade Palace services.
                  </p>
                </div>

                <div
                  data-profile-card-block
                  className="grid gap-8 md:grid-cols-2"
                >
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
                  ).map(([key, label]) => {
                    const isReadOnly =
                      key === "email" ||
                      !isEditing ||
                      (key === "location" && !isCustomerProfile);

                    return (
                      <div
                        key={key}
                        data-profile-field
                        data-profile-input-wrap
                        className="relative"
                      >
                        <label
                          data-profile-label
                          className="mb-3 block text-sm uppercase tracking-[0.24em] text-neutral-500"
                        >
                          {label}
                        </label>
                        <input
                          type="text"
                          value={profile[key]}
                          readOnly={isReadOnly}
                          onChange={(event) => handleChange(key, event.target.value)}
                          className={`w-full bg-transparent pb-4 text-lg text-neutral-900 outline-none ${
                            isReadOnly ? "cursor-not-allowed text-neutral-500" : ""
                          }`}
                        />
                        <div
                          data-profile-field-line
                          className="h-px w-full bg-neutral-200"
                        />
                        <div
                          data-profile-active-line
                          className={`absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 ${
                            isReadOnly ? "bg-neutral-300" : "bg-emerald-700"
                          }`}
                        />
                      </div>
                    );
                  })}

                  <div
                    data-profile-field
                    data-profile-input-wrap
                    className="relative"
                  >
                    <label
                      data-profile-label
                      className="mb-3 block text-sm uppercase tracking-[0.24em] text-neutral-500"
                    >
                      Language
                    </label>
                    <select
                      disabled={!isEditing || !isCustomerProfile}
                      value={profile.language}
                      onChange={(event) => handleChange("language", event.target.value)}
                      className={`w-full bg-transparent pb-4 text-lg text-neutral-900 outline-none ${
                        !isEditing || !isCustomerProfile
                          ? "cursor-not-allowed text-neutral-500"
                          : ""
                      }`}
                    >
                      <option value="English">English</option>
                      <option value="Chinese">Chinese</option>
                      <option value="Thai">Thai</option>
                      <option value="Myanmar">Myanmar</option>
                    </select>
                    <div
                      data-profile-field-line
                      className="h-px w-full bg-neutral-200"
                    />
                    <div
                      data-profile-active-line
                      className={`absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 ${
                        !isEditing || !isCustomerProfile
                          ? "bg-neutral-300"
                          : "bg-emerald-700"
                      }`}
                    />
                  </div>
                </div>

                <div
                  data-profile-card-block
                  className="border-t border-neutral-200 pt-8"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                    Connected Services
                  </p>
                  <h3 className="mt-2 text-2xl font-light tracking-[-0.03em] text-neutral-950">
                    LINE & notifications
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-neutral-600">
                    Connect LINE, verify your official account status, and manage
                    notification preferences from the same panel.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      data-profile-pressable
                      onClick={handleConnectLine}
                      disabled={isConnectingLine}
                      className="inline-flex w-full items-center justify-center gap-2 border border-emerald-700 bg-emerald-700 px-4 py-3 text-sm uppercase tracking-[0.2em] text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {isConnectingLine
                        ? "Connecting LINE..."
                        : profile.lineUserId
                          ? "Reconnect with LINE"
                          : "Connect with LINE"}
                    </button>
                    {profile.lineUserId ? (
                      <p className="text-sm leading-6 text-neutral-500">
                        Connected LINE User ID: {profile.lineUserId}
                      </p>
                    ) : null}
                  </div>

                  <div
                    data-profile-card-block
                    className="mt-6 rounded-[28px] border border-neutral-200 bg-[#fbfbf8] px-5 py-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-500">
                      Official Verification
                    </p>
                    <p className="mt-3 text-sm leading-6 text-neutral-600">
                      {lineOfficialIsVerified
                        ? `Verified at ${new Date(profile.lineOfficialVerifiedAt).toLocaleString()}`
                        : "Not verified yet. Connect with LINE to continue verification on a separate page."}
                    </p>
                  </div>

                  <div data-profile-card-block className="mt-6 grid gap-3">
                    <label
                      data-profile-pressable
                      className="inline-flex items-center gap-3 rounded-[24px] border border-neutral-200 bg-white/78 px-4 py-4 text-sm text-neutral-700"
                    >
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

                    <label
                      data-profile-pressable
                      className="inline-flex items-center gap-3 rounded-[24px] border border-neutral-200 bg-white/78 px-4 py-4 text-sm text-neutral-700"
                    >
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
            </div>
          </div>
        </div>

        <section
          data-profile-panel
          className="mt-14 overflow-hidden rounded-[36px] border border-white/75 bg-white/84 p-6 shadow-[0_35px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8 lg:p-10"
        >
          <div className="border-b border-neutral-200 pb-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">
              Membership
            </p>
            <h3 className="mt-2 text-3xl font-light tracking-[-0.03em] text-neutral-950">
              Tiers & Benefits
            </h3>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div
              data-profile-tier
              className={`rounded-[28px] border p-6 transition ${
                profile.tierCode === "REGULAR"
                  ? "border-neutral-900 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
                  : "border-neutral-200 bg-[#faf9f5]"
              }`}
            >
              <h4 className="mb-2 text-base font-semibold">Regular</h4>
              <p className="mb-4 text-sm text-neutral-500">
                Default membership level.
              </p>
              <p className="text-sm">• Assigned automatically for new customers</p>
              <p className="text-sm">
                • Upgrade path starts after phone or LINE verification
              </p>
            </div>

            <div
              data-profile-tier
              className={`rounded-[28px] border p-6 transition ${
                profile.tierCode === "VIP"
                  ? "border-emerald-700 bg-emerald-50 shadow-[0_18px_44px_rgba(5,150,105,0.12)]"
                  : "border-neutral-200 bg-[#faf9f5]"
              }`}
            >
              <h4 className="mb-2 text-base font-semibold">VIP</h4>
              <p className="mb-4 text-sm text-neutral-500">
                Verify your customer identity first
              </p>
              <p className="text-sm">
                • Requires verified phone number OR connected LINE account
              </p>
              <p className="text-sm">
                • Unlocks VIP customer targeting and queue priority
              </p>
            </div>

            <div
              data-profile-tier
              className={`rounded-[28px] border p-6 transition ${
                profile.tierCode === "ULTRA_VIP"
                  ? "border-amber-600 bg-amber-50 shadow-[0_18px_44px_rgba(217,119,6,0.12)]"
                  : "border-neutral-200 bg-[#faf9f5]"
              }`}
            >
              <h4 className="mb-2 text-base font-semibold">VVIP</h4>
              <p className="mb-4 text-sm text-neutral-500">Highest customer tier</p>
              <p className="text-sm">
                • Requires VIP eligibility (verified phone or connected LINE)
              </p>
              <p className="text-sm">
                • Requires at least 1 completed purchase OR current owned product
              </p>
            </div>
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div
            data-profile-danger
            className="rounded-[34px] border border-red-200 bg-red-50/90 p-6 shadow-[0_20px_50px_rgba(220,38,38,0.08)]"
          >
            <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-red-800">
              Delete Account
            </h4>
            <p className="mt-3 text-sm leading-6 text-red-700">
              This action is permanent. You must verify OTP by Email or LINE to
              delete your account.
            </p>
            <button
              type="button"
              data-profile-pressable
              onClick={handleOpenDeleteModal}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-red-600 px-4 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-red-700 sm:w-auto"
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 size={16} />
                Delete Account
              </span>
            </button>
          </div>

          <div
            data-profile-danger
            className="rounded-[34px] border border-white/70 bg-white/82 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          >
            <div className="mb-6 border border-neutral-200 bg-[#faf9f5] p-4">
              <p className="text-sm leading-relaxed tracking-wide text-neutral-600">
                Sign out when you&apos;re finished managing your account,
                profile, and member benefits.
              </p>
            </div>
            <button
              data-profile-pressable
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex w-full items-center justify-center gap-2 bg-neutral-900 px-4 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              <LogOut size={16} />
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-4">
          <div
            ref={deleteModalRef}
            className="w-full max-w-xl border border-black/8 bg-white p-6 shadow-[0_26px_90px_rgba(15,23,42,0.28)] sm:p-7"
          >
            <div
              data-delete-modal-piece
              className="flex items-start justify-between gap-4 border-b border-black/8 pb-4"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                  Confirm deletion
                </p>
                <h2 className="mt-2 text-2xl font-light tracking-[-0.03em] text-neutral-950">
                  Delete Account
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Choose OTP method, verify code, then your account will be permanently deleted.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleteOtpBusy !== null}
                className="border border-neutral-200 px-3 py-2 text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div data-delete-modal-piece className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteOtpMethodChange("EMAIL")}
                  disabled={deleteOtpBusy !== null}
                  className={`border px-3 py-3 text-sm uppercase tracking-[0.2em] transition ${
                    deleteOtpMethod === "EMAIL"
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  Email OTP
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOtpMethodChange("LINE")}
                  disabled={deleteOtpBusy !== null}
                  className={`border px-3 py-3 text-sm uppercase tracking-[0.2em] transition ${
                    deleteOtpMethod === "LINE"
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  LINE OTP
                </button>
              </div>

              <div
                data-delete-modal-piece
                className="border border-black/8 bg-[#faf9f5] p-4"
              >
                {deleteOtpMethod === "EMAIL" ? (
                  <p className="text-sm leading-6 text-neutral-600">
                    Send a 6 digit OTP to your account email
                    {deleteOtpMaskedEmail ? ` (${deleteOtpMaskedEmail})` : ""}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm leading-6 text-neutral-600">
                      Send a 6 digit OTP to your connected LINE account.
                    </p>
                    <a
                      href={resolvedDeleteOtpLineAddFriendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-sm text-emerald-700 underline underline-offset-2"
                    >
                      Add LINE Official Account
                    </a>
                  </div>
                )}
              </div>

              <div
                data-delete-modal-piece
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <button
                  type="button"
                  onClick={() => {
                    void handleSendDeleteOtp();
                  }}
                  disabled={deleteOtpBusy !== null}
                  className="bg-neutral-900 px-4 py-3 text-sm uppercase tracking-[0.2em] text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
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
                  placeholder="6 digit code"
                  className="w-full border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                />
              </div>

              <button
                data-delete-modal-piece
                type="button"
                onClick={() => {
                  void handleVerifyDeleteOtp();
                }}
                disabled={
                  deleteOtpBusy !== null ||
                  deleteOtpCode.length !== 6 ||
                  !deleteOtpChallengeId
                }
                className="w-full bg-red-600 px-4 py-3 text-sm uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteOtpBusy === "verify" ? "Verifying..." : "Verify OTP and Delete Account"}
              </button>

              {deleteOtpError ? (
                <div
                  data-delete-modal-piece
                  className="border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
                >
                  {deleteOtpError}
                </div>
              ) : null}

              {deleteOtpInfo ? (
                <div
                  data-delete-modal-piece
                  className="border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700"
                >
                  {deleteOtpInfo}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
