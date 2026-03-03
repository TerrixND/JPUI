"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  createManagerCommissionPolicy,
  filterManagerBranchStaff,
  getManagerAnalyticsBranches,
  getManagerBranchUsers,
  getManagerCommissionPolicies,
  getManagerProducts,
  updateManagerCommissionPolicy,
  type ManagerBranchUser,
  type ManagerCommissionPolicyRecord,
  type ManagerProductSummary,
} from "@/lib/managerApi";
import {
  formatManagerDateTime,
  getManagerProductLabel,
  getManagerProductPreviewUrl,
  getManagerUserLabel,
} from "@/lib/managerDashboardUi";

type PolicyDraft = {
  salespersonUserId: string;
  rate: string;
  activeFrom: string;
  activeTo: string;
  priority: string;
  note: string;
  isActive: boolean;
};

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const toDateTimeLocal = (value: string | null) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

export default function ManagerInventoryCommissionPage() {
  const params = useParams();
  const { dashboardBasePath } = useRole();
  const productId = String(params.productId || "");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [product, setProduct] = useState<ManagerProductSummary | null>(null);
  const [salesUsers, setSalesUsers] = useState<ManagerBranchUser[]>([]);
  const [policies, setPolicies] = useState<ManagerCommissionPolicyRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>({});
  const [createDraft, setCreateDraft] = useState<PolicyDraft>({
    salespersonUserId: "",
    rate: "",
    activeFrom: "",
    activeTo: "",
    priority: "100",
    note: "",
    isActive: true,
  });

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

  const loadContext = useCallback(
    async (nextBranchId?: string) => {
      const resolvedBranchId = nextBranchId || branchId;
      if (!resolvedBranchId || !productId) {
        setProduct(null);
        setSalesUsers([]);
        setPolicies([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        const [productResponse, userResponse, policyResponse] = await Promise.all([
          getManagerProducts({
            accessToken,
            branchId: resolvedBranchId,
          }),
          getManagerBranchUsers({
            accessToken,
            branchId: resolvedBranchId,
          }),
          getManagerCommissionPolicies({
            accessToken,
            branchId: resolvedBranchId,
            productId,
            limit: 100,
          }),
        ]);

        const matchedProduct =
          productResponse.products.find((entry) => entry.id === productId) || null;
        const salesRows = filterManagerBranchStaff(userResponse.users, ["SALES"]);

        setProduct(matchedProduct);
        setSalesUsers(salesRows);
        setPolicies(policyResponse.records);
        setDrafts(
          Object.fromEntries(
            policyResponse.records.map((policy) => [
              policy.id,
              {
                salespersonUserId: policy.salespersonUserId || "",
                rate: policy.rate !== null ? String(policy.rate) : "",
                activeFrom: toDateTimeLocal(policy.activeFrom),
                activeTo: toDateTimeLocal(policy.activeTo),
                priority:
                  policy.priority !== null ? String(policy.priority) : "100",
                note: policy.note || "",
                isActive: policy.isActive !== false,
              },
            ]),
          ),
        );
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setProduct(null);
        setSalesUsers([]);
        setPolicies([]);
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [branchId, getAccessToken, productId],
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const firstBranchId = await loadBranches();
        await loadContext(firstBranchId);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }
        setBranchOptions([]);
        setProduct(null);
        setSalesUsers([]);
        setPolicies([]);
        setError(getErrorMessage(caughtError));
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadBranches, loadContext]);

  useEffect(() => {
    if (branchId) {
      void loadContext(branchId);
    }
  }, [branchId, loadContext]);

  const salesUserOptions = useMemo(
    () =>
      salesUsers.map((user) => ({
        id: user.userId,
        label: getManagerUserLabel(user),
      })),
    [salesUsers],
  );

  const savePolicy = async (policy: ManagerCommissionPolicyRecord) => {
    const draft = drafts[policy.id];
    if (!draft) {
      return;
    }

    const parsedRate = Number(draft.rate);
    const parsedPriority = Number(draft.priority);
    if (!draft.salespersonUserId || Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      setError("Salesperson and a valid rate are required.");
      return;
    }
    if (Number.isNaN(parsedPriority)) {
      setError("Priority must be a valid number.");
      return;
    }

    setSavingId(policy.id);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      await updateManagerCommissionPolicy({
        accessToken,
        policyId: policy.id,
        salespersonUserId: draft.salespersonUserId,
        rate: parsedRate,
        productId,
        activeFrom: draft.activeFrom ? new Date(draft.activeFrom).toISOString() : null,
        activeTo: draft.activeTo ? new Date(draft.activeTo).toISOString() : null,
        priority: parsedPriority,
        note: draft.note || null,
        isActive: draft.isActive,
      });
      setNotice("Commission policy updated.");
      await loadContext(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setSavingId("");
    }
  };

  const createPolicy = async () => {
    const parsedRate = Number(createDraft.rate);
    const parsedPriority = Number(createDraft.priority);
    if (
      !createDraft.salespersonUserId ||
      Number.isNaN(parsedRate) ||
      parsedRate < 0 ||
      parsedRate > 100
    ) {
      setError("Salesperson and a valid rate are required.");
      return;
    }
    if (Number.isNaN(parsedPriority)) {
      setError("Priority must be a valid number.");
      return;
    }

    setCreating(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      await createManagerCommissionPolicy({
        accessToken,
        branchId,
        salespersonUserId: createDraft.salespersonUserId,
        rate: parsedRate,
        productId,
        activeFrom: createDraft.activeFrom
          ? new Date(createDraft.activeFrom).toISOString()
          : undefined,
        activeTo: createDraft.activeTo
          ? new Date(createDraft.activeTo).toISOString()
          : undefined,
        priority: parsedPriority,
        note: createDraft.note || undefined,
      });
      setNotice("Commission policy created.");
      setCreateDraft({
        salespersonUserId: "",
        rate: "",
        activeFrom: "",
        activeTo: "",
        priority: "100",
        note: "",
        isActive: true,
      });
      await loadContext(branchId);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={product ? `${getManagerProductLabel(product)} Commissions` : "Commission Policy"}
        description="Configure salesperson commission policy for this inventory product."
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
              href={`${dashboardBasePath}/inventory`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Inventory
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

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900" />
          <div className="h-80 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900" />
        </div>
      ) : !product ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-400">
          This inventory product was not found for the selected branch.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40">
              {getManagerProductPreviewUrl(product) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getManagerProductPreviewUrl(product)}
                  alt={`${getManagerProductLabel(product)} preview`}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                  No preview
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {getManagerProductLabel(product)}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Visibility: {product.visibility || "-"} · Branch rate: {product.branchCommissionRate ?? 0}%
              </p>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-800/40">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Create Policy
              </h3>
              <select
                value={createDraft.salespersonUserId}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    salespersonUserId: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              >
                <option value="">Select salesperson</option>
                {salesUserOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={createDraft.rate}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, rate: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                placeholder="Rate"
              />
              <input
                type="number"
                value={createDraft.priority}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, priority: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                placeholder="Priority"
              />
              <input
                type="datetime-local"
                value={createDraft.activeFrom}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, activeFrom: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
              <input
                type="datetime-local"
                value={createDraft.activeTo}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, activeTo: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
              />
              <textarea
                value={createDraft.note}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, note: event.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                placeholder="Note"
              />
              <button
                type="button"
                onClick={() => {
                  void createPolicy();
                }}
                disabled={creating}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create Product Policy"}
              </button>
            </div>
          </aside>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Existing Product Policies
            </h2>
            <div className="mt-4 space-y-4">
              {policies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-5 py-8 text-sm text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                  No product-specific commission policies found yet.
                </div>
              ) : (
                policies.map((policy) => {
                  const draft = drafts[policy.id];
                  if (!draft) {
                    return null;
                  }

                  return (
                    <div
                      key={policy.id}
                      className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {policy.salesperson?.displayName ||
                              policy.salesperson?.user?.email ||
                              policy.salespersonUserId ||
                              "-"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Updated {formatManagerDateTime(policy.updatedAt)}
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [policy.id]: {
                                  ...draft,
                                  isActive: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Active
                        </label>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <select
                          value={draft.salespersonUserId}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [policy.id]: {
                                ...draft,
                                salespersonUserId: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        >
                          <option value="">Select salesperson</option>
                          {salesUserOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.rate}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [policy.id]: {
                                ...draft,
                                rate: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        />
                        <input
                          type="number"
                          value={draft.priority}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [policy.id]: {
                                ...draft,
                                priority: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        />
                        <input
                          type="datetime-local"
                          value={draft.activeFrom}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [policy.id]: {
                                ...draft,
                                activeFrom: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        />
                        <input
                          type="datetime-local"
                          value={draft.activeTo}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [policy.id]: {
                                ...draft,
                                activeTo: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                        />
                        <input
                          value={draft.note}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [policy.id]: {
                                ...draft,
                                note: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-200"
                          placeholder="Note"
                        />
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            void savePolicy(policy);
                          }}
                          disabled={savingId === policy.id}
                          className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                        >
                          {savingId === policy.id ? "Saving..." : "Save Policy"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
