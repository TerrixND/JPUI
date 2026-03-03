"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  banManagerUser,
  getManagerAnalyticsBranches,
  getManagerBranchUsers,
  getManagerCommissionPolicies,
  getManagerSalespersonPerformance,
  restrictManagerUser,
  updateManagerUserStatus,
  type ManagerBranchUser,
  type ManagerCommissionPolicyRecord,
  type ManagerSalespersonPerformance,
} from "@/lib/managerApi";
import {
  formatManagerDateTime,
  getManagerUserLabel,
  managerMoney,
  managerStatusBadge,
} from "@/lib/managerDashboardUi";

const STATUS_OPTIONS = ["ACTIVE", "RESTRICTED", "BANNED", "TERMINATED"] as const;
const ACTION_TYPES = ["RESTRICTION", "BAN"] as const;
const DURATION_PRESETS = [
  { value: "1h", label: "1 hour", hours: 1 },
  { value: "4h", label: "4 hours", hours: 4 },
  { value: "24h", label: "24 hours", hours: 24 },
];

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

export default function ManagerUserDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { dashboardBasePath } = useRole();
  const userId = String(params.userId || "");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchId, setBranchId] = useState(searchParams.get("branchId") || "");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [user, setUser] = useState<ManagerBranchUser | null>(null);
  const [policies, setPolicies] = useState<ManagerCommissionPolicyRecord[]>([]);
  const [performance, setPerformance] = useState<ManagerSalespersonPerformance | null>(null);

  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("ACTIVE");
  const [actionType, setActionType] = useState<(typeof ACTION_TYPES)[number]>("RESTRICTION");
  const [durationPreset, setDurationPreset] =
    useState<(typeof DURATION_PRESETS)[number]["value"]>("24h");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

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

  const loadBranches = useCallback(async () => {
    const accessToken = await getAccessToken();
    const analytics = await getManagerAnalyticsBranches({ accessToken });
    const options = analytics.branches
      .map((row) => row.branch)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((branch) => ({
        id: branch.id,
        label: [branch.code, branch.name].filter(Boolean).join(" · ") || branch.id,
      }));

    setBranchOptions(options);
    setBranchId((current) => current || options[0]?.id || "");
    return options[0]?.id || "";
  }, [getAccessToken]);

  const loadUser = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId || !userId) {
        setUser(null);
        setPolicies([]);
        setPerformance(null);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const branchUsers = await getManagerBranchUsers({
          accessToken,
          branchId: resolvedBranchId,
        });
        const matchedUser =
          branchUsers.users.find((entry) => entry.userId === userId) || null;
        setUser(matchedUser);
        setStatus(
          (matchedUser?.status as (typeof STATUS_OPTIONS)[number]) || "ACTIVE",
        );

        if (!matchedUser) {
          setPolicies([]);
          setPerformance(null);
          return;
        }

        if (matchedUser.role === "SALES") {
          const [policyResponse, performanceResponse] = await Promise.all([
            getManagerCommissionPolicies({
              accessToken,
              branchId: resolvedBranchId,
              salespersonUserId: matchedUser.userId,
              limit: 100,
            }),
            getManagerSalespersonPerformance({
              accessToken,
              salespersonUserId: matchedUser.userId,
              branchId: resolvedBranchId,
            }),
          ]);

          setPolicies(policyResponse.records);
          setPerformance(performanceResponse);
        } else {
          setPolicies([]);
          setPerformance(null);
        }
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setUser(null);
        setPolicies([]);
        setPerformance(null);
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [branchId, getAccessToken, userId],
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const firstBranchId = await loadBranches();
        await loadUser(firstBranchId);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setBranchOptions([]);
        setUser(null);
        setPolicies([]);
        setPerformance(null);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches, loadUser]);

  useEffect(() => {
    if (branchId) {
      void loadUser(branchId);
    }
  }, [branchId, loadUser]);

  const applyStatus = async () => {
    if (!user) {
      return;
    }

    setActionLoading(true);
    setNotice("");
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await updateManagerUserStatus({
        accessToken,
        userId: user.userId,
        status,
        branchId,
        reason: reason.trim() || undefined,
      });
      setNotice(response.message || "User status updated.");
      await loadUser(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setActionLoading(false);
    }
  };

  const submitAction = async () => {
    if (!user) {
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }

    setActionLoading(true);
    setNotice("");
    setError("");

    try {
      const accessToken = await getAccessToken();
      const duration = DURATION_PRESETS.find((preset) => preset.value === durationPreset);
      if (!duration) {
        throw new Error("Select a valid duration.");
      }

      const startsAt = new Date();
      const endsAt = new Date(
        startsAt.getTime() + duration.hours * 60 * 60 * 1000,
      ).toISOString();
      const response =
        actionType === "RESTRICTION"
          ? await restrictManagerUser({
              accessToken,
              userId: user.userId,
              branchId,
              reason: reason.trim(),
              note: note.trim() || null,
              startsAt: startsAt.toISOString(),
              endsAt,
            })
          : await banManagerUser({
              accessToken,
              userId: user.userId,
              branchId,
              reason: reason.trim(),
              note: note.trim() || null,
              startsAt: startsAt.toISOString(),
              endsAt,
            });

      setNotice(response.message || `${actionType} request submitted.`);
      setReason("");
      setNote("");
      await loadUser(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setActionLoading(false);
    }
  };

  const displayName = user ? getManagerUserLabel(user) : "User Detail";

  return (
    <div className="space-y-6">
      <PageHeader
        title={displayName}
        description="Manage user status, moderation requests, and role-specific commission context."
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700/60 dark:bg-gray-900"
            >
              <option value="">Select branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
            <Link
              href={`${dashboardBasePath}/users`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Users
            </Link>
          </div>
        }
      />

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
                />
              ))}
            </div>
          ) : !user ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              User was not found in the selected branch.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${managerStatusBadge(user.status)}`}
                >
                  {user.status || "UNKNOWN"}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {user.role === "MANAGER" && user.isPrimary ? "BRANCH_ADMIN" : user.role || "-"}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Email
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.email || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Assigned At
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatManagerDateTime(user.assignedAt)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Restrictions
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.accessRestrictionCount}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Active Policies
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.commissionSummary.activeSalespersonPolicyCount}
                  </p>
                </div>
              </div>

              {user.role === "MANAGER" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                  Manager capability changes remain governed by Staff Rules and branch-admin authority.
                  {" "}
                  <Link
                    href={`${dashboardBasePath}/staff-rules`}
                    className="font-semibold underline"
                  >
                    Open Staff Rules
                  </Link>
                  {" "}
                  to review branch-manager capability sources.
                </div>
              ) : null}

              {user.role === "SALES" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Sales Performance
                    </h2>
                    {!performance ? (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        No performance payload loaded.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <div className="rounded-xl bg-white px-3 py-3 text-sm dark:bg-gray-900">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Sales
                          </p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                            {performance.salesTotalCount}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-3 text-sm dark:bg-gray-900">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Sales Value
                          </p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                            {managerMoney.format(performance.salesTotalAmount)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-3 text-sm dark:bg-gray-900">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Commissions
                          </p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                            {performance.commissionsTotalCount}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-3 text-sm dark:bg-gray-900">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Commission Value
                          </p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                            {managerMoney.format(performance.commissionsTotalAmount)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Commission Policies
                      </h2>
                      <Link
                        href={`${dashboardBasePath}/commissions`}
                        className="text-sm font-medium text-emerald-700 dark:text-emerald-300"
                      >
                        Open Commissions
                      </Link>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 dark:text-gray-400">
                            <th className="py-2 font-medium">Rate</th>
                            <th className="py-2 font-medium">Scope</th>
                            <th className="py-2 font-medium">Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {policies.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-4 text-gray-400 dark:text-gray-500">
                                No commission policies found.
                              </td>
                            </tr>
                          ) : (
                            policies.map((policy) => (
                              <tr key={policy.id} className="border-t border-gray-200 dark:border-gray-700/60">
                                <td className="py-3 text-gray-900 dark:text-gray-100">
                                  {policy.rate ?? "-"}%
                                </td>
                                <td className="py-3 text-gray-600 dark:text-gray-300">
                                  {policy.product?.name || policy.productTier || policy.scope || "-"}
                                </td>
                                <td className="py-3 text-gray-500 dark:text-gray-400">
                                  {formatManagerDateTime(policy.activeFrom)} to{" "}
                                  {formatManagerDateTime(policy.activeTo)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Status
            </h2>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])
              }
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void applyStatus();
              }}
              disabled={actionLoading || !user}
              className="mt-3 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {actionLoading ? "Saving..." : "Apply Status"}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Restrict or Ban
            </h2>
            <div className="mt-3 space-y-3">
              <select
                value={actionType}
                onChange={(event) =>
                  setActionType(event.target.value as (typeof ACTION_TYPES)[number])
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              >
                {ACTION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={durationPreset}
                onChange={(event) =>
                  setDurationPreset(event.target.value as (typeof DURATION_PRESETS)[number]["value"])
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              >
                {DURATION_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="Optional note"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={() => {
                  void submitAction();
                }}
                disabled={actionLoading || !user}
                className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {actionLoading ? "Submitting..." : `Submit ${actionType.toLowerCase()}`}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
