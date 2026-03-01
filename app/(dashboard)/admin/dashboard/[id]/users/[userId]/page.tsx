"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import { ADMIN_ACTION_BLOCKS } from "@/lib/adminAccessControl";
import supabase from "@/lib/supabase";
import {
  createAdminUserBan,
  createAdminUserRestriction,
  getAdminUserDetail,
  handleAccountAccessDeniedError,
  resolveAdminUserAction,
  updateAdminUserPermissions,
  updateAdminUserStatus,
  type AdminActionBlock,
  type AdminUserDetail,
  type StaffRuleVisibilityRole,
} from "@/lib/apiClient";
import {
  ACCOUNT_STATUS_OPTIONS,
  ADMIN_CAPABILITY_DEFINITIONS,
  ADMIN_VISIBILITY_ROLE_OPTIONS,
  PRODUCT_ACTION_TYPE_OPTIONS,
  type AdminCapabilityKey,
} from "@/lib/adminUiConfig";
import {
  accountStatusBadge,
  formatDate,
  formatDateTime,
  getPrimaryBranchName,
  getUserDetailDisplayName,
  getUserEmail,
  getUserLineId,
  getUserPhone,
  roleBadge,
} from "@/lib/adminUiHelpers";

type PermissionDraft = {
  visibilityRole: StaffRuleVisibilityRole;
  capabilities: Record<AdminCapabilityKey, boolean>;
  autoApprove: Partial<Record<AdminCapabilityKey, boolean>>;
};

type ActionType = (typeof PRODUCT_ACTION_TYPE_OPTIONS)[number];

const ACTION_BLOCK_COPY: Record<AdminActionBlock, string> = {
  PRODUCT_CREATE: "Product Create",
  PRODUCT_EDIT: "Product Edit",
  PRODUCT_VISIBILITY_MANAGE: "Product Visibility",
  PRODUCT_DELETE: "Product Delete",
  INVENTORY_REQUEST_DECIDE: "Inventory Requests",
  USER_ACCESS_MANAGE: "User Access",
  APPROVAL_REVIEW: "Approval Review",
  STAFF_RULE_MANAGE: "Staff Rules",
  LOG_DELETE: "Log Delete",
};

const formatActionMessage = (
  label: string,
  response: { statusCode: number; message: string | null },
) => {
  if (response.statusCode === 202) {
    return response.message || `${label} submitted for main admin approval.`;
  }

  return response.message || `${label} applied successfully.`;
};

const DURATION_PRESET_HOURS: Record<string, number> = {
  "1h": 1,
  "4h": 4,
  "12h": 12,
  "24h": 24,
};

const emptyCapabilities = () =>
  Object.fromEntries(
    ADMIN_CAPABILITY_DEFINITIONS.map((item) => [item.key, false]),
  ) as Record<AdminCapabilityKey, boolean>;

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readPermissionDraft = (detail: AdminUserDetail | null): PermissionDraft => {
  const base: PermissionDraft = {
    visibilityRole:
      detail?.role === "ADMIN"
        ? "ADMIN"
        : detail?.role === "MANAGER"
          ? "MANAGER"
          : "SALES",
    capabilities: emptyCapabilities(),
    autoApprove: {},
  };

  if (!detail) {
    return base;
  }

  if (detail.isMainAdmin) {
    return {
      visibilityRole: "ADMIN",
      capabilities: Object.fromEntries(
        ADMIN_CAPABILITY_DEFINITIONS.map((item) => [item.key, true]),
      ) as Record<AdminCapabilityKey, boolean>,
      autoApprove: Object.fromEntries(
        ADMIN_CAPABILITY_DEFINITIONS
          .filter((item) => item.approval !== "Main admin approval")
          .map((item) => [item.key, true]),
      ) as Partial<Record<AdminCapabilityKey, boolean>>,
    };
  }

  const candidates = [
    detail.raw,
    asRecord(detail.raw)?.permissions,
    asRecord(detail.raw)?.permission,
    detail.adminProfile,
    asRecord(detail.adminProfile)?.permissions,
    asRecord(detail.managerProfile)?.permissions,
    asRecord(detail.salespersonProfile)?.permissions,
  ];

  let visibilityRole = base.visibilityRole;

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (!record) {
      continue;
    }

    const visibilitySources = [
      record.visibilityRole,
      asRecord(record.admin)?.visibilityRole,
      asRecord(record.manager)?.visibilityRole,
    ];

    for (const visibilityValue of visibilitySources) {
      const normalized = String(visibilityValue || "").trim().toUpperCase();
      if (normalized === "ADMIN" || normalized === "MANAGER" || normalized === "SALES") {
        visibilityRole = normalized as StaffRuleVisibilityRole;
        break;
      }
    }

    const capabilitySources = [
      record.capabilities,
      asRecord(record.admin)?.capabilities,
      asRecord(record.manager)?.capabilities,
    ];

    for (const source of capabilitySources) {
      const capabilityRecord = asRecord(source);
      if (!capabilityRecord) {
        continue;
      }

      for (const item of ADMIN_CAPABILITY_DEFINITIONS) {
        if (typeof capabilityRecord[item.key] === "boolean") {
          base.capabilities[item.key] = capabilityRecord[item.key] as boolean;
        }
      }
    }

    const autoApproveSources = [
      record.autoApprove,
      record.autoApproval,
      asRecord(record.approvals)?.autoApprove,
    ];

    for (const source of autoApproveSources) {
      const autoRecord = asRecord(source);
      if (!autoRecord) {
        continue;
      }

      for (const item of ADMIN_CAPABILITY_DEFINITIONS) {
        if (typeof autoRecord[item.key] === "boolean") {
          base.autoApprove[item.key] = autoRecord[item.key] as boolean;
        }
      }
    }
  }

  return {
    visibilityRole,
    capabilities: base.capabilities,
    autoApprove: base.autoApprove,
  };
};

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function InfoField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-sm text-gray-800 dark:text-gray-200 ${mono ? "font-mono" : ""}`}>
        {value || "-"}
      </p>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const { dashboardBasePath, isMainAdmin } = useRole();
  const userId = String(params.userId || "");

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uiMessage, setUiMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft>(() =>
    readPermissionDraft(null),
  );
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");
  const [actionType, setActionType] = useState<ActionType>("RESTRICTION");
  const [actionReason, setActionReason] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionPreset, setActionPreset] = useState("24h");
  const [actionUntil, setActionUntil] = useState("");
  const [restrictionMode, setRestrictionMode] = useState<"ACCOUNT" | "ADMIN_ACTIONS">(
    "ACCOUNT",
  );
  const [actionBlocks, setActionBlocks] = useState<AdminActionBlock[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [resolvingId, setResolvingId] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const accessToken = session?.access_token || "";
    if (!accessToken) {
      throw new Error("Missing access token. Please sign in again.");
    }

    return accessToken;
  }, []);

  const loadDetail = useCallback(async () => {
    if (!userId) {
      setError("Missing user id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminUserDetail({ accessToken, userId });
      setDetail(response);
      setPermissionDraft(readPermissionDraft(response));
      setSelectedStatus(response.status || "ACTIVE");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setDetail(null);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load user detail.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, userId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const displayName = useMemo(() => getUserDetailDisplayName(detail), [detail]);
  const primaryBranch = useMemo(
    () => (detail ? getPrimaryBranchName(detail) : "-"),
    [detail],
  );
  const canEditPermissions = detail?.role === "ADMIN" || detail?.isMainAdmin;

  const onToggleCapability = (key: AdminCapabilityKey, checked: boolean) => {
    setPermissionDraft((current) => {
      const nextCapabilities = {
        ...current.capabilities,
        [key]: checked,
      };

      if (key === "canCreateProducts" && checked) {
        nextCapabilities.canEditProducts = true;
      }

      if (key === "canEditProducts" && !checked && current.capabilities.canCreateProducts) {
        nextCapabilities.canCreateProducts = false;
      }

      return {
        ...current,
        capabilities: nextCapabilities,
      };
    });
  };

  const toggleActionBlock = (block: AdminActionBlock) => {
    setActionBlocks((current) =>
      current.includes(block)
        ? current.filter((value) => value !== block)
        : [...current, block],
    );
  };

  const resolveTimeWindow = () => {
    const startsAt = new Date();

    if (actionPreset === "custom") {
      if (!actionUntil) {
        throw new Error("Select the custom end date.");
      }

      const endsAt = new Date(actionUntil);
      if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
        throw new Error("The end date must be in the future.");
      }

      return {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      };
    }

    const durationHours = DURATION_PRESET_HOURS[actionPreset];
    if (!durationHours) {
      throw new Error("Select a valid duration.");
    }

    return {
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
    };
  };

  const onSavePermissions = async () => {
    if (!detail) {
      return;
    }

    setSavingPermissions(true);
    setUiMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await updateAdminUserPermissions({
        accessToken,
        userId: detail.id,
        permissions: {
          visibilityRole: permissionDraft.visibilityRole,
          capabilities: permissionDraft.capabilities,
          autoApprove: permissionDraft.autoApprove,
        },
      });

      setUiMessage(formatActionMessage("Permissions update", response));
      await loadDetail();
    } catch (caughtError) {
      setUiMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update permissions.",
      );
    } finally {
      setSavingPermissions(false);
    }
  };

  const onSaveStatus = async () => {
    if (!detail) {
      return;
    }

    setSavingStatus(true);
    setUiMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await updateAdminUserStatus({
        accessToken,
        userId: detail.id,
        status: selectedStatus,
      });

      setUiMessage(formatActionMessage("Status update", response));
      await loadDetail();
    } catch (caughtError) {
      setUiMessage(
        caughtError instanceof Error ? caughtError.message : "Failed to update status.",
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const onStageAction = async () => {
    if (!detail) {
      return;
    }

    if (!actionReason.trim()) {
      setActionMessage("Reason is required.");
      return;
    }

    setSavingAction(true);
    setActionMessage("");

    try {
      const accessToken = await getAccessToken();

      if (actionType === "TERMINATION") {
        const response = await updateAdminUserStatus({
          accessToken,
          userId: detail.id,
          status: "TERMINATED",
          reason: actionReason.trim(),
        });

        setActionMessage(formatActionMessage("Termination", response));
      } else {
        const { startsAt, endsAt } = resolveTimeWindow();

        if (actionType === "RESTRICTION") {
          if (restrictionMode === "ADMIN_ACTIONS" && actionBlocks.length === 0) {
            throw new Error("Select at least one admin action block.");
          }

          const response = await createAdminUserRestriction({
            accessToken,
            userId: detail.id,
            reason: actionReason.trim(),
            note: actionNote.trim() || null,
            startsAt,
            endsAt,
            restrictionMode,
            adminActionBlocks:
              restrictionMode === "ADMIN_ACTIONS" ? actionBlocks : undefined,
          });

          setActionMessage(formatActionMessage("Restriction", response));
        } else {
          const response = await createAdminUserBan({
            accessToken,
            userId: detail.id,
            reason: actionReason.trim(),
            note: actionNote.trim() || null,
            startsAt,
            endsAt,
          });

          setActionMessage(formatActionMessage("Ban", response));
        }
      }

      await loadDetail();
    } catch (caughtError) {
      setActionMessage(
        caughtError instanceof Error ? caughtError.message : "Failed to save the action.",
      );
    } finally {
      setSavingAction(false);
    }
  };

  const onResolveAction = async (actionTypeValue: ActionType, controlId?: string) => {
    if (!detail) {
      return;
    }

    setResolvingId(controlId || actionTypeValue);
    setActionMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await resolveAdminUserAction({
        accessToken,
        userId: detail.id,
        actionType: actionTypeValue,
        controlId,
      });

      setActionMessage(formatActionMessage("Resolve action", response));
      await loadDetail();
    } catch (caughtError) {
      setActionMessage(
        caughtError instanceof Error ? caughtError.message : "Failed to resolve action.",
      );
    } finally {
      setResolvingId("");
    }
  };

  if (!isMainAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User Detail"
          description="User Settings is only available to Main Admin."
          action={
            <Link
              href={`${dashboardBasePath}/users`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Users
            </Link>
          }
        />

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
          Admin accounts can inspect user snapshots from the users list, but the full User
          Settings flow is reserved for Main Admin.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={loading ? "User Detail" : displayName}
        description="Main admin user setting view with permissions, history links, and account actions."
        action={
          <Link
            href={`${dashboardBasePath}/users`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to Users
          </Link>
        }
      />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-200">
        This screen now saves permissions, direct status changes, timed restrictions, bans,
        termination, and resolve actions through the updated admin user-management routes.
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <SectionCard
        title="User Snapshot"
        description="Container 1: name, role, status, and account details."
      >
        {loading || !detail ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${roleBadge(detail.role, detail.isMainAdmin)}`}
              >
                {detail.isMainAdmin ? "MAIN ADMIN" : detail.role || "-"}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${accountStatusBadge(detail.status)}`}
              >
                {detail.status || "-"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {primaryBranch}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoField label="Name" value={displayName} />
              <InfoField label="Email" value={getUserEmail(detail)} />
              <InfoField label="Phone" value={getUserPhone(detail)} />
              <InfoField label="Line ID" value={getUserLineId(detail)} />
              <InfoField label="User ID" value={detail.id} mono />
              <InfoField label="Role" value={detail.isMainAdmin ? "MAIN ADMIN" : detail.role || "-"} />
              <InfoField label="Joined At" value={formatDateTime(detail.createdAt)} />
              <InfoField label="Last Updated" value={formatDateTime(detail.updatedAt)} />
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="History Links"
        description="Container 2: audit log and request history are separate pages from the detail screen."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href={`${dashboardBasePath}/users/${userId}/audit-log`}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-gray-700/60 dark:bg-gray-800/40 dark:hover:border-emerald-700/60 dark:hover:bg-emerald-900/10"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">User Audit Log</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Review actor and target activity involving this user.
            </p>
          </Link>

          <Link
            href={`${dashboardBasePath}/users/${userId}/requests`}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-gray-700/60 dark:bg-gray-800/40 dark:hover:border-emerald-700/60 dark:hover:bg-emerald-900/10"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">User Requests</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Track pending, approved, and rejected requests with timestamps.
            </p>
          </Link>
        </div>
      </SectionCard>

      <SectionCard
        title="Permissions"
        description="Container 3: edit the stored permission profile and save it to the dedicated permissions route."
      >
        {!detail ? null : canEditPermissions ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Visibility Role
                </label>
                <select
                  value={permissionDraft.visibilityRole}
                  onChange={(event) =>
                    setPermissionDraft((current) => ({
                      ...current,
                      visibilityRole: event.target.value as StaffRuleVisibilityRole,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                >
                  {ADMIN_VISIBILITY_ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-200">
                  Auto-approve flags are sent together with the capability profile so the backend
                  can keep future approval behavior aligned with this user.
                </div>
              </div>

              <div className="grid gap-3">
                {ADMIN_CAPABILITY_DEFINITIONS.map((capability) => {
                  const supportsAutoApprove = capability.approval === "Optional auto approval";
                  return (
                    <div
                      key={capability.key}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {capability.label}
                            </p>
                            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {capability.approval}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {capability.helper}
                          </p>
                        </div>

                        <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700/60">
                          <input
                            type="checkbox"
                            checked={permissionDraft.capabilities[capability.key]}
                            onChange={(event) =>
                              onToggleCapability(capability.key, event.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Enabled
                        </label>
                      </div>

                      {supportsAutoApprove ? (
                        <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={permissionDraft.autoApprove[capability.key] === true}
                            onChange={(event) =>
                              setPermissionDraft((current) => ({
                                ...current,
                                autoApprove: {
                                  ...current.autoApprove,
                                  [capability.key]: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Auto approve after first approved action
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800/40">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current account status
                {" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedStatus}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                >
                  {ACCOUNT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    void onSavePermissions();
                  }}
                  disabled={savingPermissions || savingStatus}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  {savingPermissions ? "Saving..." : "Save Permissions"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onSaveStatus();
                  }}
                  disabled={savingPermissions || savingStatus}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {savingStatus ? "Saving..." : "Apply Status"}
                </button>
              </div>
            </div>

            {uiMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                {uiMessage}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-6 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/20 dark:text-gray-400">
            This user is not an admin account. Manager and sales permission editing will be
            finalized through the updated onboarding and staff rule endpoints.
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Admin Actions"
        description="Container 4: restrict, ban, terminate, and resolve existing access controls."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(event) => setActionType(event.target.value as ActionType)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                >
                  {PRODUCT_ACTION_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Duration Preset
                </label>
                <select
                  value={actionPreset}
                  onChange={(event) => setActionPreset(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                  <option value="12h">12 hours</option>
                  <option value="24h">24 hours</option>
                  <option value="custom">Custom until date</option>
                </select>
              </div>
            </div>

            {actionType === "RESTRICTION" ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Restriction Mode
                  </label>
                  <select
                    value={restrictionMode}
                    onChange={(event) =>
                      setRestrictionMode(event.target.value as "ACCOUNT" | "ADMIN_ACTIONS")
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                  >
                    <option value="ACCOUNT">ACCOUNT</option>
                    <option value="ADMIN_ACTIONS">ADMIN_ACTIONS</option>
                  </select>
                </div>

                {restrictionMode === "ADMIN_ACTIONS" ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                      Admin Action Blocks
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {ADMIN_ACTION_BLOCKS.map((block) => (
                        <label
                          key={block}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={actionBlocks.includes(block)}
                            onChange={() => toggleActionBlock(block)}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          {ACTION_BLOCK_COPY[block]}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {actionPreset === "custom" ? (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Until Date
                </label>
                <input
                  type="datetime-local"
                  value={actionUntil}
                  onChange={(event) => setActionUntil(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                />
              </div>
            ) : null}

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                Reason
              </label>
              <input
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder="Reason for restriction, ban, or termination"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                Note
              </label>
              <textarea
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                rows={4}
                placeholder="Internal note for the moderation action"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void onStageAction();
                }}
                disabled={savingAction}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                {savingAction ? "Saving..." : "Save Action"}
              </button>
              {detail?.status === "TERMINATED" ? (
                <button
                  type="button"
                  onClick={() => {
                    void onResolveAction("TERMINATION");
                  }}
                  disabled={resolvingId === "TERMINATION"}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {resolvingId === "TERMINATION" ? "Resolving..." : "Resolve Termination"}
                </button>
              ) : null}
            </div>

            {actionMessage ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                {actionMessage}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Active Access Controls
              </h3>
              <div className="mt-3 space-y-3">
                {detail?.activeAccessControls.length ? (
                  detail.activeAccessControls.map((control) => (
                    <div
                      key={control.id}
                      className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700/60 dark:bg-gray-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          {control.type}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {formatDateTime(control.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                        {control.reason || "No reason provided."}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(control.startsAt)} to {formatDate(control.endsAt)}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void onResolveAction(
                            control.type === "BAN" ? "BAN" : "RESTRICTION",
                            control.id,
                          );
                        }}
                        disabled={resolvingId === control.id}
                        className="mt-3 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        {resolvingId === control.id ? "Resolving..." : "Resolve"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {detail?.status === "TERMINATED"
                      ? "No timed controls are active. Use the termination resolve button to restore access."
                      : "No active restrictions or bans."}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Requests Snapshot
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <InfoField
                  label="Submitted"
                  value={String(detail?.approvalRequestsSubmitted.length || 0)}
                />
                <InfoField
                  label="Targeted"
                  value={String(detail?.approvalRequestsTargeted.length || 0)}
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
