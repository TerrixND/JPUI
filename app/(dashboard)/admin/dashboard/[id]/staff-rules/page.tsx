"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  getAdminStaffRules,
  createAdminStaffRule,
  revokeAdminStaffRule,
  type StaffOnboardingRule,
  type CreateStaffRulePayload,
  type StaffRuleVisibilityRole,
  type StaffRuleManagerType,
  type StaffRuleAdminCapabilities,
  type StaffRuleManagerCapabilities,
} from "@/lib/apiClient";
import { getAdminActionRestrictionTooltip } from "@/lib/adminAccessControl";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PROVISIONABLE_ROLES = ["ADMIN", "MANAGER", "SALES"] as const;
const BRANCH_REQUIRED_ROLES: ReadonlySet<string> = new Set(["SALES"]);
const STATUS_TABS = ["ALL", "PENDING", "EXPIRED", "CLAIMED", "REVOKED"] as const;
const VISIBILITY_ROLE_OPTIONS: StaffRuleVisibilityRole[] = ["ADMIN", "MANAGER", "SALES"];
const MANAGER_TYPE_OPTIONS: StaffRuleManagerType[] = ["STANDALONE", "BRANCH_MANAGER", "BRANCH_ADMIN"];

const ADMIN_CAPABILITY_OPTIONS: Array<{
  key: keyof StaffRuleAdminCapabilities;
  label: string;
}> = [
  { key: "canReadProducts", label: "Read products" },
  { key: "canCreateProducts", label: "Create products" },
  { key: "canEditProducts", label: "Edit products" },
  { key: "canHandleRequests", label: "Handle requests" },
  { key: "canDeleteLogs", label: "Delete logs" },
  { key: "canManageProductVisibility", label: "Manage product visibility" },
  { key: "canManageStaffRules", label: "Manage staff rules" },
  { key: "canRestrictUsers", label: "Restrict users" },
  { key: "canBanUsers", label: "Ban users" },
];

const MANAGER_CAPABILITY_OPTIONS: Array<{
  key: keyof StaffRuleManagerCapabilities;
  label: string;
}> = [
  { key: "canCreateStaffRules", label: "Create staff rules" },
  { key: "canApproveRequests", label: "Approve requests" },
  { key: "canRequestProductsFromAdmin", label: "Request products from admin" },
  { key: "canRequestManagerRestrictions", label: "Request manager restrictions" },
  { key: "canRequestManagerBans", label: "Request manager bans" },
  { key: "canRestrictSubordinates", label: "Restrict subordinates" },
  { key: "canBanSubordinates", label: "Ban subordinates" },
  { key: "canLimitSubordinatePermissions", label: "Limit subordinate permissions" },
];

const DEFAULT_ADMIN_CAPABILITIES: StaffRuleAdminCapabilities = {
  canReadProducts: true,
  canCreateProducts: true,
  canEditProducts: true,
  canHandleRequests: true,
  canDeleteLogs: true,
  canManageProductVisibility: true,
  canManageStaffRules: true,
  canRestrictUsers: true,
  canBanUsers: true,
};

const DEFAULT_MANAGER_CAPABILITIES: StaffRuleManagerCapabilities = {
  canCreateStaffRules: true,
  canApproveRequests: true,
  canRequestProductsFromAdmin: true,
  canRequestManagerRestrictions: false,
  canRequestManagerBans: false,
  canRestrictSubordinates: false,
  canBanSubordinates: false,
  canLimitSubordinatePermissions: false,
};

const normalizeManagerCapabilities = (
  managerType: StaffRuleManagerType,
  capabilities: StaffRuleManagerCapabilities,
) => {
  const next: StaffRuleManagerCapabilities = { ...capabilities };
  let changed = false;
  const apply = (key: keyof StaffRuleManagerCapabilities, value: boolean) => {
    if (next[key] !== value) {
      next[key] = value;
      changed = true;
    }
  };

  if (managerType === "STANDALONE") {
    apply("canCreateStaffRules", false);
    apply("canApproveRequests", false);
    apply("canRequestProductsFromAdmin", true);
    apply("canRequestManagerRestrictions", true);
    apply("canRequestManagerBans", true);
    apply("canRestrictSubordinates", false);
    apply("canBanSubordinates", false);
    apply("canLimitSubordinatePermissions", false);
  } else {
    apply("canRequestManagerRestrictions", false);
    apply("canRequestManagerBans", false);

    if (managerType !== "BRANCH_ADMIN") {
      apply("canRestrictSubordinates", false);
      apply("canBanSubordinates", false);
      apply("canLimitSubordinatePermissions", false);
    }
  }

  if (managerType === "BRANCH_ADMIN") {
    apply("canCreateStaffRules", true);
    apply("canApproveRequests", true);
    apply("canRequestProductsFromAdmin", true);
  }

  if (!next.canRequestManagerRestrictions) {
    apply("canRequestManagerBans", false);
  }
  if (!next.canRestrictSubordinates) {
    apply("canBanSubordinates", false);
  }
  if (!next.canCreateStaffRules) {
    apply("canLimitSubordinatePermissions", false);
  }

  return changed ? next : capabilities;
};

type BranchOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: string;
};

type ApiErrorPayload = {
  message?: unknown;
  code?: unknown;
  reason?: unknown;
};

type BranchAnalyticsResponse = {
  branches?: BranchOption[];
  message?: string;
};

const toErrorMessage = (payload: ApiErrorPayload | null, fallback: string) => {
  const message = typeof payload?.message === "string" ? payload.message : fallback;
  const code = typeof payload?.code === "string" ? ` (code: ${payload.code})` : "";
  const reason = typeof payload?.reason === "string" ? ` (reason: ${payload.reason})` : "";
  return `${message}${code}${reason}`;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) return value.message;
  return "Unexpected error.";
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatBranchLabel = (branch: BranchOption) => {
  const code = branch.code ? `${branch.code} – ` : "";
  const city = branch.city ? ` (${branch.city})` : "";
  const status = branch.status !== "ACTIVE" ? ` [${branch.status}]` : "";
  return `${code}${branch.name}${city}${status}`;
};

/* ------------------------------------------------------------------ */
/* Status / role styling                                               */
/* ------------------------------------------------------------------ */

const statusBadgeClass: Record<string, string> = {
  PENDING: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  EXPIRED: "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
  CLAIMED: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  REVOKED: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
};

const roleBadgeClass: Record<string, string> = {
  ADMIN: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  MANAGER: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  SALES: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
};

/* ------------------------------------------------------------------ */
/* Icons (inline SVG)                                                  */
/* ------------------------------------------------------------------ */

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const IconX = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const IconWarning = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const IconUser = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const IconRefresh = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AdminStaffRules() {
  type ProvisionableRole = (typeof PROVISIONABLE_ROLES)[number];

  const { isAdminActionBlocked } = useRole();
  const staffRuleManageBlocked = isAdminActionBlocked("STAFF_RULE_MANAGE");
  const staffRuleManageTooltip = getAdminActionRestrictionTooltip("STAFF_RULE_MANAGE");

  /* -------- Rules state -------- */
  const [rules, setRules] = useState<StaffOnboardingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]>("ALL");

  /* -------- Branches state -------- */
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  /* -------- Create form state -------- */
  const [formOpen, setFormOpen] = useState(false);
  const [formRole, setFormRole] = useState<ProvisionableRole>("SALES");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formLineId, setFormLineId] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formBranchName, setFormBranchName] = useState("");
  const [formSetAsPrimaryManager, setFormSetAsPrimaryManager] = useState(false);
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formAdminVisibilityRole, setFormAdminVisibilityRole] =
    useState<StaffRuleVisibilityRole>("SALES");
  const [formAdminCapabilities, setFormAdminCapabilities] =
    useState<StaffRuleAdminCapabilities>({ ...DEFAULT_ADMIN_CAPABILITIES });
  const [formManagerType, setFormManagerType] = useState<StaffRuleManagerType>("BRANCH_MANAGER");
  const [formManagerVisibilityRole, setFormManagerVisibilityRole] =
    useState<StaffRuleVisibilityRole>("SALES");
  const [formManagerCapabilities, setFormManagerCapabilities] =
    useState<StaffRuleManagerCapabilities>({ ...DEFAULT_MANAGER_CAPABILITIES });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  /* -------- Revoke state -------- */
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState("");

  /* -------- Expanded card on mobile -------- */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* -------- Auth -------- */
  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    const accessToken = session?.access_token || "";
    if (!accessToken) throw new Error("Missing access token. Please sign in again.");
    return accessToken;
  }, []);

  /* -------- Load rules -------- */
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const accessToken = await getAccessToken();
      const data = await getAdminStaffRules({
        accessToken,
        status: activeTab === "ALL" ? undefined : activeTab,
        limit: 200,
      });
      setRules(data);
    } catch (caughtError) {
      setRules([]);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, activeTab]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  /* -------- Load branches -------- */
  useEffect(() => {
    const loadBranches = async () => {
      setBranchesLoading(true);
      try {
        const accessToken = await getAccessToken();
        const response = await fetch("/api/v1/admin/analytics/branches", {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | ApiErrorPayload
          | BranchAnalyticsResponse
          | null;

        if (!response.ok) {
          throw new Error(toErrorMessage(payload as ApiErrorPayload | null, "Failed to load branches."));
        }

        const branchRows = Array.isArray((payload as BranchAnalyticsResponse)?.branches)
          ? ((payload as BranchAnalyticsResponse).branches as BranchOption[])
          : [];
        setBranches(branchRows);
      } catch {
        setBranches([]);
      } finally {
        setBranchesLoading(false);
      }
    };
    loadBranches();
  }, [getAccessToken]);

  /* -------- Create rule -------- */
  const resetForm = () => {
    setFormRole("SALES");
    setFormEmail("");
    setFormPhone("");
    setFormDisplayName("");
    setFormLineId("");
    setFormNote("");
    setFormBranchId("");
    setFormBranchName("");
    setFormSetAsPrimaryManager(false);
    setFormExpiresAt("");
    setFormAdminVisibilityRole("SALES");
    setFormAdminCapabilities({ ...DEFAULT_ADMIN_CAPABILITIES });
    setFormManagerType("BRANCH_MANAGER");
    setFormManagerVisibilityRole("SALES");
    setFormManagerCapabilities({ ...DEFAULT_MANAGER_CAPABILITIES });
    setCreateError("");
  };

  useEffect(() => {
    if (formManagerType === "STANDALONE") {
      setFormBranchId("");
      setFormSetAsPrimaryManager(false);
    }
    if (formManagerType !== "BRANCH_ADMIN") {
      setFormBranchName("");
    }
    if (formManagerType !== "BRANCH_ADMIN") {
      setFormSetAsPrimaryManager(false);
    }
    setFormManagerCapabilities((previous) =>
      normalizeManagerCapabilities(formManagerType, previous),
    );
  }, [formManagerType]);

  const onCreateRule = async () => {
    setCreateError("");
    const normalizedBranchName = formBranchName.trim();

    if (staffRuleManageBlocked) {
      setCreateError(staffRuleManageTooltip);
      return;
    }

    if (!formEmail.trim()) {
      setCreateError("Email is required.");
      return;
    }
    if (!formPhone.trim()) {
      setCreateError("Phone is required.");
      return;
    }
    if (formBranchId && normalizedBranchName) {
      setCreateError("Use either branch selection or branch name, not both.");
      return;
    }
    if (formRole === "ADMIN" && (formBranchId || normalizedBranchName)) {
      setCreateError("Branch fields are not allowed for ADMIN role.");
      return;
    }
    if (formRole === "MANAGER" && formSetAsPrimaryManager && formManagerType !== "BRANCH_ADMIN") {
      setCreateError("Set as primary manager is allowed only for BRANCH_ADMIN manager type.");
      return;
    }
    if (BRANCH_REQUIRED_ROLES.has(formRole) && !formBranchId) {
      setCreateError(`Branch is required for ${formRole} role.`);
      return;
    }
    if (formRole === "MANAGER" && formManagerType === "STANDALONE" && (formBranchId || normalizedBranchName)) {
      setCreateError("Standalone manager cannot have branch selection or branch name.");
      return;
    }
    if (formRole === "MANAGER" && formManagerType === "BRANCH_MANAGER" && !formBranchId) {
      setCreateError("Branch is required for BRANCH_MANAGER manager type.");
      return;
    }
    if (formRole === "MANAGER" && formManagerType === "BRANCH_MANAGER" && normalizedBranchName) {
      setCreateError("Branch name is only supported for BRANCH_ADMIN manager type.");
      return;
    }
    if (formRole === "MANAGER" && formManagerType === "BRANCH_ADMIN" && !formBranchId && !normalizedBranchName) {
      setCreateError("Provide existing branch or branch name for BRANCH_ADMIN onboarding.");
      return;
    }
    if (formRole === "SALES" && !formDisplayName.trim()) {
      setCreateError("Display name is required for SALES role.");
      return;
    }

    setCreating(true);
    try {
      const accessToken = await getAccessToken();
      const payload: CreateStaffRulePayload = {
        role: formRole,
        email: formEmail.trim(),
        phone: formPhone.trim(),
      };

      if (formDisplayName.trim()) payload.displayName = formDisplayName.trim();
      if (formLineId.trim()) payload.lineId = formLineId.trim();
      if (formNote.trim()) payload.note = formNote.trim();
      if (
        formBranchId &&
        (formRole === "SALES" ||
          (formRole === "MANAGER" &&
            (formManagerType === "BRANCH_MANAGER" || formManagerType === "BRANCH_ADMIN")))
      ) {
        payload.branchId = formBranchId;
      }
      if (formRole === "MANAGER" && formManagerType === "BRANCH_ADMIN" && normalizedBranchName) {
        payload.branchName = normalizedBranchName;
      }
      if (formRole === "MANAGER" && formManagerType === "BRANCH_ADMIN") {
        payload.setAsPrimaryManager = formSetAsPrimaryManager;
      }
      if (formExpiresAt) payload.expiresAt = new Date(formExpiresAt).toISOString();

      if (formRole === "ADMIN") {
        payload.permissions = {
          visibilityRole: formAdminVisibilityRole,
          capabilities: formAdminCapabilities,
        };
      }

      if (formRole === "MANAGER") {
        payload.permissions = {
          managerType: formManagerType,
          visibilityRole: formManagerVisibilityRole,
          capabilities: normalizeManagerCapabilities(formManagerType, formManagerCapabilities),
        };
      }

      await createAdminStaffRule({ accessToken, payload });
      resetForm();
      setFormOpen(false);
      await loadRules();
    } catch (caughtError) {
      setCreateError(getErrorMessage(caughtError));
    } finally {
      setCreating(false);
    }
  };

  /* -------- Revoke rule -------- */
  const onRevokeRule = async (ruleId: string) => {
    setRevokeError("");

    if (staffRuleManageBlocked) {
      setRevokeError(staffRuleManageTooltip);
      return;
    }

    setRevokingId(ruleId);
    try {
      const accessToken = await getAccessToken();
      await revokeAdminStaffRule({ accessToken, ruleId });
      await loadRules();
    } catch (caughtError) {
      setRevokeError(getErrorMessage(caughtError));
    } finally {
      setRevokingId(null);
    }
  };

  /* -------- Derived -------- */
  const managerRequiresBranch = formRole === "MANAGER" && formManagerType === "BRANCH_MANAGER";
  const canSelectExistingBranch =
    BRANCH_REQUIRED_ROLES.has(formRole) ||
    (formRole === "MANAGER" &&
      (formManagerType === "BRANCH_MANAGER" || formManagerType === "BRANCH_ADMIN"));
  const isBranchSelectionRequired = BRANCH_REQUIRED_ROLES.has(formRole) || managerRequiresBranch;
  const canInputBranchName = formRole === "MANAGER" && formManagerType === "BRANCH_ADMIN";
  const canSetPrimaryManager = formRole === "MANAGER" && formManagerType === "BRANCH_ADMIN";
  const needsDisplayName = formRole === "SALES";
  const managerTypeRequiresBranchAdminNote =
    formRole === "MANAGER" && formManagerType !== "BRANCH_ADMIN";
  const managerCapabilitiesForForm = normalizeManagerCapabilities(
    formManagerType,
    formManagerCapabilities,
  );
  const isManagerCapabilityDisabled = (capabilityKey: keyof StaffRuleManagerCapabilities) => {
    if (formManagerType === "STANDALONE") {
      return true;
    }

    if (
      capabilityKey === "canRequestManagerRestrictions" ||
      capabilityKey === "canRequestManagerBans"
    ) {
      return true;
    }

    if (
      (capabilityKey === "canRestrictSubordinates" ||
        capabilityKey === "canBanSubordinates" ||
        capabilityKey === "canLimitSubordinatePermissions") &&
      formManagerType !== "BRANCH_ADMIN"
    ) {
      return true;
    }

    if (
      formManagerType === "BRANCH_ADMIN" &&
      (capabilityKey === "canCreateStaffRules" ||
        capabilityKey === "canApproveRequests" ||
        capabilityKey === "canRequestProductsFromAdmin")
    ) {
      return true;
    }

    if (
      capabilityKey === "canRequestManagerBans" &&
      !managerCapabilitiesForForm.canRequestManagerRestrictions
    ) {
      return true;
    }

    if (capabilityKey === "canBanSubordinates" && !managerCapabilitiesForForm.canRestrictSubordinates) {
      return true;
    }

    if (
      capabilityKey === "canLimitSubordinatePermissions" &&
      !managerCapabilitiesForForm.canCreateStaffRules
    ) {
      return true;
    }

    return false;
  };
  const activeBranches = branches.filter((b) => b.status === "ACTIVE");

  const statusCounts = rules.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.status] = (acc[rule.status] || 0) + 1;
    return acc;
  }, {});

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff Onboarding Rules"
        description="Pre-configure rules for new staff members. Each rule is claimed when the matching user signs up."
        action={
          <button
            type="button"
            onClick={() => {
              if (staffRuleManageBlocked) {
                return;
              }
              resetForm();
              setFormOpen(true);
            }}
            disabled={staffRuleManageBlocked}
            title={staffRuleManageBlocked ? staffRuleManageTooltip : undefined}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <IconPlus />
            New Rule
          </button>
        }
      />

      {staffRuleManageBlocked && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg text-xs text-amber-700 dark:text-amber-300">
          {staffRuleManageTooltip}
        </div>
      )}

      {/* -------- Status tabs -------- */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = tab === "ALL" ? rules.length : statusCounts[tab] || 0;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
              {!loading && (
                <span className={`ml-1.5 ${isActive ? "text-emerald-200" : "text-gray-400 dark:text-gray-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => void loadRules()}
          disabled={loading}
          className="ml-1 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <IconRefresh />
        </button>
      </div>

      {/* -------- Revoke error banner -------- */}
      {revokeError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg text-xs text-red-700 dark:text-red-300">
          <IconWarning />
          {revokeError}
          <button type="button" onClick={() => setRevokeError("")} className="ml-auto text-red-400 hover:text-red-600">
            <IconX />
          </button>
        </div>
      )}

      {/* -------- Loading -------- */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded-full" />
              </div>
              <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
              <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* -------- Error -------- */}
      {!loading && error && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 px-5 py-12 text-center">
          <div className="text-red-300 mx-auto mb-3">
            <IconWarning />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button
            type="button"
            onClick={() => void loadRules()}
            className="mt-3 px-4 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* -------- Empty state -------- */}
      {!loading && !error && rules.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 px-5 py-16 text-center">
          <div className="mx-auto mb-3 w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
            <IconUser />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No rules found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {activeTab === "ALL"
              ? "Create a new rule to get started."
              : `No ${activeTab.toLowerCase()} rules at the moment.`}
          </p>
        </div>
      )}

      {/* -------- Rules list -------- */}
      {!loading && !error && rules.length > 0 && (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isExpanded = expandedId === rule.id;
            const isRevoking = revokingId === rule.id;
            const canRevoke = rule.status === "PENDING";

            return (
              <div
                key={rule.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden transition-shadow hover:shadow-sm"
              >
                {/* Main row */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* Left: badges + info */}
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${roleBadgeClass[rule.role] || "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                        >
                          {rule.role}
                        </span>
                        {rule.branch && (
                          <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-medium">
                            {rule.branch.code ? `${rule.branch.code} – ` : ""}
                            {rule.branch.name || "Unknown"}
                          </span>
                        )}
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClass[rule.status] || "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
                        >
                          {rule.status}
                        </span>
                        {rule.setAsPrimaryManager && (
                          <span className="inline-block px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-[11px] font-medium">
                            Primary Manager
                          </span>
                        )}
                      </div>

                      {/* Contact info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{rule.email || "-"}</span>
                        <span className="text-gray-400 dark:text-gray-500">{rule.phone || "-"}</span>
                        {rule.displayName && (
                          <span className="text-gray-500 dark:text-gray-400">{rule.displayName}</span>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                        <span>Created {formatDateTime(rule.createdAt)}</span>
                        {rule.createdAt && (
                          <span className="text-gray-300">{formatRelativeTime(rule.createdAt)}</span>
                        )}
                        {rule.expiresAt && (
                          <span className="text-amber-500 dark:text-amber-400">Expires {formatDateTime(rule.expiresAt)}</span>
                        )}
                      </div>

                      {rule.note && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">&ldquo;{rule.note}&rdquo;</p>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle detail (mobile) */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                        className="sm:hidden p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {canRevoke && (
                        <button
                          type="button"
                          onClick={() => void onRevokeRule(rule.id)}
                          disabled={isRevoking || staffRuleManageBlocked}
                          title={staffRuleManageBlocked ? staffRuleManageTooltip : undefined}
                          className="px-3 py-1.5 border border-red-200 dark:border-red-700/50 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isRevoking ? "Revoking..." : "Revoke"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Desktop detail (always visible on sm+) */}
                  <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/40">
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Line ID</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{rule.lineId || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Created By</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{rule.createdByUser?.email || rule.createdByUserId || "-"}</p>
                    </div>
                    {rule.claimedAt && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Claimed</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          {formatDateTime(rule.claimedAt)}
                          {rule.claimedByUser?.email && (
                            <span className="text-gray-400 dark:text-gray-500 ml-1">by {rule.claimedByUser.email}</span>
                          )}
                        </p>
                      </div>
                    )}
                    {rule.revokedAt && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Revoked</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          {formatDateTime(rule.revokedAt)}
                          {rule.revokedByUser?.email && (
                            <span className="text-gray-400 dark:text-gray-500 ml-1">by {rule.revokedByUser.email}</span>
                          )}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Rule ID</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate">{rule.id}</p>
                    </div>
                  </div>
                </div>

                {/* Mobile expanded detail */}
                {isExpanded && (
                  <div className="sm:hidden px-4 pb-4 space-y-2.5 border-t border-gray-100 dark:border-gray-700/40 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Line ID</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{rule.lineId || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Created By</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 break-all">{rule.createdByUser?.email || rule.createdByUserId || "-"}</p>
                      </div>
                      {rule.claimedAt && (
                        <div className="col-span-2">
                          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Claimed</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                            {formatDateTime(rule.claimedAt)}
                            {rule.claimedByUser?.email && <span className="text-gray-400 dark:text-gray-500 ml-1">by {rule.claimedByUser.email}</span>}
                          </p>
                        </div>
                      )}
                      {rule.revokedAt && (
                        <div className="col-span-2">
                          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Revoked</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                            {formatDateTime(rule.revokedAt)}
                            {rule.revokedByUser?.email && <span className="text-gray-400 dark:text-gray-500 ml-1">by {rule.revokedByUser.email}</span>}
                          </p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Rule ID</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 break-all">{rule.id}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================ */}
      {/* Create Rule Modal / Overlay                                      */}
      {/* ================================================================ */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!creating) {
                setFormOpen(false);
              }
            }}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg mx-4 sm:mx-auto mt-16 sm:mt-0 bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60 flex items-center justify-between shrink-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Onboarding Rule</h3>
              <button
                type="button"
                onClick={() => {
                  if (!creating) setFormOpen(false);
                }}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <IconX />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Role */}
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Role <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  {PROVISIONABLE_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setFormRole(role);
                        if (role === "ADMIN") {
                          setFormBranchId("");
                          setFormBranchName("");
                          setFormSetAsPrimaryManager(false);
                        }
                        if (role !== "MANAGER") {
                          setFormBranchName("");
                        }
                        if (role !== "MANAGER") {
                          setFormSetAsPrimaryManager(false);
                        }
                      }}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        formRole === role
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                          : "border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permission Configuration */}
              {formRole === "ADMIN" && (
                <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/50 space-y-3">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Permission Configuration
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Visibility Role
                    </label>
                    <select
                      value={formAdminVisibilityRole}
                      onChange={(e) => setFormAdminVisibilityRole(e.target.value as StaffRuleVisibilityRole)}
                      className={inputClass}
                    >
                      {VISIBILITY_ROLE_OPTIONS.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Capabilities
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ADMIN_CAPABILITY_OPTIONS.map((option) => (
                        <label
                          key={option.key}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formAdminCapabilities[option.key] === true}
                            onChange={(e) =>
                              setFormAdminCapabilities((previous) => ({
                                ...previous,
                                [option.key]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {formRole === "MANAGER" && (
                <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/50 space-y-3">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Permission Configuration
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                        Manager Type
                      </label>
                      <select
                        value={formManagerType}
                        onChange={(e) => setFormManagerType(e.target.value as StaffRuleManagerType)}
                        className={inputClass}
                      >
                        {MANAGER_TYPE_OPTIONS.map((typeOption) => (
                          <option key={typeOption} value={typeOption}>
                            {typeOption}
                          </option>
                        ))}
                      </select>
                      {formManagerType === "BRANCH_ADMIN" && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1.5">
                          Use existing branch selection or provide a new branch name below.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                        Visibility Role
                      </label>
                      <select
                        value={formManagerVisibilityRole}
                        onChange={(e) => setFormManagerVisibilityRole(e.target.value as StaffRuleVisibilityRole)}
                        className={inputClass}
                      >
                        {VISIBILITY_ROLE_OPTIONS.map((roleOption) => (
                          <option key={roleOption} value={roleOption}>
                            {roleOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Capabilities
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MANAGER_CAPABILITY_OPTIONS.map((option) => {
                        const disabled = isManagerCapabilityDisabled(option.key);
                        return (
                          <label
                            key={option.key}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                              disabled
                                ? "border-gray-200 dark:border-gray-700/60 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                : "border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900 cursor-pointer"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={managerCapabilitiesForForm[option.key] === true}
                              disabled={disabled}
                              onChange={(e) =>
                                setFormManagerCapabilities((previous) =>
                                  normalizeManagerCapabilities(formManagerType, {
                                    ...previous,
                                    [option.key]: e.target.checked,
                                  }),
                                )
                              }
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500"
                            />
                            <span className="text-xs">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {managerTypeRequiresBranchAdminNote && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
                        Restrict, ban, and limit-subordinate capabilities are available only for
                        BRANCH_ADMIN manager type.
                      </p>
                    )}
                    {formManagerType === "STANDALONE" && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
                        Standalone capability profile is fixed by policy and cannot be edited.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="staff@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+66812345678"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Display Name {needsDisplayName && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="Full name or nickname"
                  className={inputClass}
                />
                {needsDisplayName && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Required for SALES role.</p>
                )}
              </div>

              {/* Line ID */}
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Line ID
                </label>
                <input
                  type="text"
                  value={formLineId}
                  onChange={(e) => setFormLineId(e.target.value)}
                  placeholder="LINE messaging ID (optional)"
                  className={inputClass}
                />
              </div>

              {/* Branch */}
              {canSelectExistingBranch && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Branch {isBranchSelectionRequired && <span className="text-red-400">*</span>}
                  </label>
                  {branchesLoading ? (
                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  ) : activeBranches.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 py-2">No active branches available.</p>
                  ) : (
                    <select
                      value={formBranchId}
                      onChange={(e) => setFormBranchId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select branch...</option>
                      {activeBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {formatBranchLabel(branch)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Branch Name (BRANCH_ADMIN only, admin route) */}
              {canInputBranchName && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    New Branch Name
                  </label>
                  <input
                    type="text"
                    value={formBranchName}
                    onChange={(e) => setFormBranchName(e.target.value)}
                    placeholder="Create new branch (leave empty to use selected branch)"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    For BRANCH_ADMIN on admin route, provide either branch selection or new branch
                    name, not both.
                  </p>
                </div>
              )}

              {/* Set as Primary Manager */}
              {formRole === "MANAGER" && (
                <div>
                  <label
                    className={`flex items-center gap-2.5 ${
                      canSetPrimaryManager ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formSetAsPrimaryManager}
                      disabled={!canSetPrimaryManager}
                      onChange={(e) => setFormSetAsPrimaryManager(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500"
                    />
                    <span className={canSetPrimaryManager ? "text-sm text-gray-700 dark:text-gray-300" : "text-sm text-gray-400 dark:text-gray-500"}>
                      Set as primary manager for the branch
                    </span>
                  </label>
                  {managerTypeRequiresBranchAdminNote && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
                      Available only when manager type is BRANCH_ADMIN.
                    </p>
                  )}
                </div>
              )}

              {/* Expires At */}
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Expires At
                </label>
                <input
                  type="datetime-local"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className={inputClass}
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Leave empty for no expiration.</p>
              </div>

              {/* Note */}
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Note
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Optional internal note..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Error */}
              {createError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
                  <span className="text-red-500 dark:text-red-400 shrink-0 mt-0.5"><IconWarning /></span>
                  <p className="text-xs text-red-700 dark:text-red-300 break-words">{createError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-end gap-2 shrink-0 bg-gray-50/50 dark:bg-gray-800/40">
              <button
                type="button"
                onClick={() => {
                  if (!creating) setFormOpen(false);
                }}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onCreateRule()}
                disabled={creating || staffRuleManageBlocked}
                title={staffRuleManageBlocked ? staffRuleManageTooltip : undefined}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  "Creating..."
                ) : (
                  <>
                    <IconCheck />
                    Create Rule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
