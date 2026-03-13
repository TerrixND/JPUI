"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  acceptStaffLineSupportRequest,
  getStaffLineSupportRequests,
  inviteStaffLineSupportRequestStaff,
  notifyAllStaffLineSupportRequestStaff,
  resolveStaffLineSupportRequest,
  type LineSupportRequestRecord,
  type SupportStaffDirectoryEntry,
} from "@/lib/lineMessagingApi";

type StaffLineRole = "manager" | "salesperson";

const SUPPORT_POLL_INTERVAL_MS = 10000;

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const sortSupportRequests = (rows: LineSupportRequestRecord[]) =>
  [...rows].sort((left, right) => {
    const leftPriority = left.status === "PENDING" ? 0 : left.status === "ACCEPTED" ? 1 : 2;
    const rightPriority = right.status === "PENDING" ? 0 : right.status === "ACCEPTED" ? 1 : 2;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftValue = left.updatedAt || left.createdAt || "";
    const rightValue = right.updatedAt || right.createdAt || "";
    return rightValue.localeCompare(leftValue);
  });

const formatTimestamp = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getSupportCustomerLabel = (record: LineSupportRequestRecord) =>
  record.customerDisplayName || record.customerEmail || "LINE customer";

const getStatusTone = (status: string | null) => {
  if (status === "ACCEPTED") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }

  if (status === "RESOLVED") {
    return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }

  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
};

const getActivityLabel = (type: string | null) => {
  switch (type) {
    case "REQUESTED":
      return "Support requested";
    case "ACCEPTED":
      return "Accepted";
    case "STAFF_INVITED":
      return "Staff invited";
    case "ALL_STAFF_NOTIFIED":
      return "All staff notified";
    case "RESOLVED":
      return "Resolved";
    default:
      return type || "Activity";
  }
};

const buildSelectedStaffMap = (staffIds: string[]) =>
  staffIds.reduce<Record<string, boolean>>((accumulator, staffId) => {
    accumulator[staffId] = true;
    return accumulator;
  }, {});

const sortActivitiesAscending = (activities: LineSupportRequestRecord["activities"]) =>
  [...activities].sort((left, right) =>
    String(left.createdAt || "").localeCompare(String(right.createdAt || "")),
  );

const buildSupportConversationHref = (pathname: string, supportRequestId: string) =>
  `${pathname}?view=conversations&supportRequestId=${encodeURIComponent(supportRequestId)}`;

export default function LineSupportQueue({
  role,
  currentUserId,
  initialSupportRequestId = "",
  getAccessToken,
}: {
  role: StaffLineRole;
  currentUserId: string;
  initialSupportRequestId?: string;
  getAccessToken: () => Promise<string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const initialSupportRequestIdRef = useRef(initialSupportRequestId.trim());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSupportRequestId, setSelectedSupportRequestId] = useState(
    initialSupportRequestId.trim(),
  );
  const [supportRequests, setSupportRequests] = useState<LineSupportRequestRecord[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<SupportStaffDirectoryEntry[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState("");

  const selectedSupportRequest = useMemo(
    () => supportRequests.find((row) => row.id === selectedSupportRequestId) || null,
    [selectedSupportRequestId, supportRequests],
  );
  const sortedActivities = useMemo(
    () =>
      selectedSupportRequest ? sortActivitiesAscending(selectedSupportRequest.activities) : [],
    [selectedSupportRequest],
  );

  const syncSelectedSupportRequest = useCallback((nextRequests: LineSupportRequestRecord[]) => {
    setSelectedSupportRequestId((current) => {
      if (current && nextRequests.some((row) => row.id === current)) {
        return current;
      }

      if (
        initialSupportRequestIdRef.current &&
        nextRequests.some((row) => row.id === initialSupportRequestIdRef.current)
      ) {
        return initialSupportRequestIdRef.current;
      }

      return nextRequests[0]?.id || "";
    });
  }, []);

  useEffect(() => {
    initialSupportRequestIdRef.current = initialSupportRequestId.trim();
    setSelectedSupportRequestId((current) =>
      initialSupportRequestId.trim() || current,
    );
  }, [initialSupportRequestId]);

  useEffect(() => {
    syncSelectedSupportRequest(supportRequests);
  }, [supportRequests, syncSelectedSupportRequest]);

  const loadSupportRequests = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true;
      if (!quiet) {
        setLoading(true);
        setError("");
      }

      try {
        const accessToken = await getAccessToken();
        const response = await getStaffLineSupportRequests({
          accessToken,
          role,
        });

        const nextRequests = sortSupportRequests(response.records);
        setSupportRequests(nextRequests);
        setStaffDirectory(response.staffDirectory);
        syncSelectedSupportRequest(nextRequests);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        if (!quiet) {
          setSupportRequests([]);
          setStaffDirectory([]);
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (!quiet) {
          setLoading(false);
        }
      }
    },
    [getAccessToken, role, syncSelectedSupportRequest],
  );

  useEffect(() => {
    void loadSupportRequests();
  }, [loadSupportRequests]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadSupportRequests({ quiet: true });
    }, SUPPORT_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadSupportRequests]);

  useEffect(() => {
    setSelectedStaffIds([]);
    setActionMessage("");
  }, [selectedSupportRequestId]);

  const inviteOptions = useMemo(
    () => staffDirectory.filter((entry) => entry.id !== currentUserId),
    [currentUserId, staffDirectory],
  );

  const selectedStaffMap = useMemo(
    () => buildSelectedStaffMap(selectedStaffIds),
    [selectedStaffIds],
  );

  const canAccept =
    selectedSupportRequest?.status === "PENDING" && !selectedSupportRequest.acceptedByUserId;
  const canManage =
    selectedSupportRequest?.status === "ACCEPTED" &&
    selectedSupportRequest.acceptedByUserId === currentUserId;
  const timelineActivities = useMemo(
    () =>
      sortedActivities.filter(
        (activity) =>
          activity.type !== "CUSTOMER_MESSAGE" && activity.type !== "STAFF_MESSAGE",
      ),
    [sortedActivities],
  );

  const applySupportRequestUpdate = useCallback((nextRecord: LineSupportRequestRecord | null) => {
    if (!nextRecord) {
      return;
    }

    setSupportRequests((current) => {
      const nextRows =
        nextRecord.status === "RESOLVED"
          ? current.filter((row) => row.id !== nextRecord.id)
          : sortSupportRequests([
              nextRecord,
              ...current.filter((row) => row.id !== nextRecord.id),
            ]);

      return nextRows;
    });

    if (nextRecord.status === "RESOLVED") {
      setSelectedSupportRequestId((current) => (current === nextRecord.id ? "" : current));
    } else {
      setSelectedSupportRequestId(nextRecord.id);
    }
  }, []);

  const withAction = useCallback(
    async (actionKey: string, run: () => Promise<void>) => {
      setActionLoading(actionKey);
      setError("");
      setNotice("");

      try {
        await run();
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        setError(getErrorMessage(caughtError));
      } finally {
        setActionLoading("");
      }
    },
    [],
  );

  const onAcceptRequest = async () => {
    if (!selectedSupportRequest) {
      return;
    }

    await withAction("accept", async () => {
      const accessToken = await getAccessToken();
      const response = await acceptStaffLineSupportRequest({
        accessToken,
        role,
        supportRequestId: selectedSupportRequest.id,
      });

      applySupportRequestUpdate(response.record);
      setNotice("Support request accepted.");
      const acceptedSupportRequestId = response.record?.id || selectedSupportRequest.id;
      router.replace(buildSupportConversationHref(pathname, acceptedSupportRequestId));
    });
  };

  const onInviteSelectedStaff = async () => {
    if (!selectedSupportRequest || !selectedStaffIds.length) {
      return;
    }

    await withAction("invite", async () => {
      const accessToken = await getAccessToken();
      const response = await inviteStaffLineSupportRequestStaff({
        accessToken,
        role,
        supportRequestId: selectedSupportRequest.id,
        staffUserIds: selectedStaffIds,
        message: actionMessage.trim() || undefined,
      });

      applySupportRequestUpdate(response.record);
      setSelectedStaffIds([]);
      setActionMessage("");
      setNotice("Selected staff were notified.");
    });
  };

  const onNotifyAllStaff = async () => {
    if (!selectedSupportRequest) {
      return;
    }

    await withAction("notify-all", async () => {
      const accessToken = await getAccessToken();
      const response = await notifyAllStaffLineSupportRequestStaff({
        accessToken,
        role,
        supportRequestId: selectedSupportRequest.id,
        message: actionMessage.trim() || undefined,
      });

      applySupportRequestUpdate(response.record);
      setActionMessage("");
      setNotice("All staff were notified.");
    });
  };

  const onResolveRequest = async () => {
    if (!selectedSupportRequest) {
      return;
    }

    await withAction("resolve", async () => {
      const accessToken = await getAccessToken();
      const response = await resolveStaffLineSupportRequest({
        accessToken,
        role,
        supportRequestId: selectedSupportRequest.id,
        message: actionMessage.trim() || undefined,
      });

      applySupportRequestUpdate(response.record);
      setActionMessage("");
      setNotice("Support request resolved.");
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300">
        <span>Support queue refreshes automatically every 10 seconds.</span>
        <div className="flex items-center gap-3">
          <span>{supportRequests.length} active support requests</span>
          <button
            type="button"
            onClick={() => void loadSupportRequests()}
            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-[72vh] grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700/60">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Support Queue
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Requests created from LINE messages like <span className="font-medium">/support english</span>.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : supportRequests.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              No active support requests right now.
            </div>
          ) : (
            <div className="max-h-[72vh] space-y-2 overflow-y-auto p-3">
              {supportRequests.map((record) => {
                const isActive = record.id === selectedSupportRequestId;

                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedSupportRequestId(record.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-600/50 dark:bg-emerald-900/20"
                        : "border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white dark:bg-slate-800/70 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {getSupportCustomerLabel(record)}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {record.requestedLanguage
                            ? `Language: ${record.requestedLanguage}`
                            : "Language not specified"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                          {record.commandText || "Support command received from LINE Official Account."}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusTone(
                          record.status,
                        )}`}
                      >
                        {record.status || "PENDING"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">
                        {record.acceptedBy?.displayName
                          ? `Accepted by ${record.acceptedBy.displayName}`
                          : "Awaiting acceptance"}
                      </span>
                      <span>{formatTimestamp(record.updatedAt || record.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eff6ff_100%)] shadow-sm dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.1),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)]">
          {selectedSupportRequest ? (
            <div className="flex h-full min-h-[72vh] flex-col">
              <div className="border-b border-white/70 px-6 py-5 backdrop-blur dark:border-slate-700/60">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {getSupportCustomerLabel(selectedSupportRequest)}
                      </h2>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(
                          selectedSupportRequest.status,
                        )}`}
                      >
                        {selectedSupportRequest.status || "PENDING"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {selectedSupportRequest.customerEmail || "LINE support request"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {selectedSupportRequest.requestedLanguage
                        ? `Requested language: ${selectedSupportRequest.requestedLanguage}`
                        : "Requested language not specified"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Created {formatTimestamp(selectedSupportRequest.createdAt)}
                      {selectedSupportRequest.lastNotifiedAt
                        ? ` · last notified ${formatTimestamp(selectedSupportRequest.lastNotifiedAt)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {selectedSupportRequest.acceptedBy?.displayName ? (
                      <span className="rounded-full bg-white/70 px-3 py-1 dark:bg-slate-800/70">
                        Owner: {selectedSupportRequest.acceptedBy.displayName}
                      </span>
                    ) : null}
                    {canAccept ? (
                      <button
                        type="button"
                        onClick={() => void onAcceptRequest()}
                        disabled={actionLoading === "accept"}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionLoading === "accept" ? "Accepting..." : "Accept Request"}
                      </button>
                    ) : null}
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            router.replace(
                              buildSupportConversationHref(pathname, selectedSupportRequest.id),
                            )
                          }
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          Open Conversation
                        </button>
                        <button
                          type="button"
                          onClick={() => void onNotifyAllStaff()}
                          disabled={actionLoading === "notify-all"}
                          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                          {actionLoading === "notify-all" ? "Notifying..." : "Notify All Staff"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onResolveRequest()}
                          disabled={actionLoading === "resolve"}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {actionLoading === "resolve" ? "Resolving..." : "Resolve"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-white/70 bg-white/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Command
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                    {selectedSupportRequest.commandText || "/support"}
                  </p>
                </div>
              </div>

              <div className="grid flex-1 gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.15fr)_340px]">
                <div className="space-y-5">
                  <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Conversation Handoff
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Once a staff member accepts the case, the live customer chat continues from the main Conversations view.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-3xl border border-dashed border-emerald-300 bg-emerald-50/80 px-4 py-5 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                      {canManage ? (
                        <>
                          Continue the support discussion from Conversations so customer replies and staff replies stay in one chat thread.
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() =>
                                router.replace(
                                  buildSupportConversationHref(pathname, selectedSupportRequest.id),
                                )
                              }
                              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                              Open Support Conversation
                            </button>
                          </div>
                        </>
                      ) : (
                        "The accepted staff member will continue the support discussion from Conversations."
                      )}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Invite Specific Staff
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Select one or more staff members to join this support case.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onInviteSelectedStaff()}
                          disabled={actionLoading === "invite" || selectedStaffIds.length === 0}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionLoading === "invite" ? "Inviting..." : "Invite Selected"}
                        </button>
                      </div>

                      <textarea
                        value={actionMessage}
                        onChange={(event) => setActionMessage(event.target.value)}
                        rows={3}
                        placeholder="Optional note for invited staff or resolution update..."
                        className="mt-4 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {inviteOptions.map((entry) => {
                          const isSelected = selectedStaffMap[entry.id] === true;
                          return (
                            <label
                              key={entry.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                                isSelected
                                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-600/50 dark:bg-emerald-900/20"
                                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) => {
                                  setSelectedStaffIds((current) =>
                                    event.target.checked
                                      ? [...current, entry.id]
                                      : current.filter((staffId) => staffId !== entry.id),
                                  );
                                }}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {entry.displayName || entry.email || entry.id}
                                </span>
                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                  {[entry.role, entry.email].filter(Boolean).join(" · ") || "Staff"}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Activity Timeline
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Support queue actions and system events for this request.
                        </p>
                      </div>
                    </div>

                    {timelineActivities.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        No activity yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {timelineActivities.map((activity) => (
                          <div
                            key={activity.id}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {getActivityLabel(activity.type)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {activity.actorDisplayName || "System"}
                                </p>
                              </div>
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {formatTimestamp(activity.createdAt)}
                              </span>
                            </div>
                            {activity.message ? (
                              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                                {activity.message}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Request Snapshot
                    </h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Customer
                        </p>
                        <p className="mt-2">{getSupportCustomerLabel(selectedSupportRequest)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Email
                        </p>
                        <p className="mt-2">{selectedSupportRequest.customerEmail || "-"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          LINE User
                        </p>
                        <p className="mt-2 break-all">{selectedSupportRequest.customerLineUserId || "-"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Accepted By
                        </p>
                        <p className="mt-2">
                          {selectedSupportRequest.acceptedBy?.displayName || "Not accepted yet"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[72vh] items-center justify-center px-6">
              <div className="max-w-md text-center">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Choose a support request
                </h2>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Select a support request from the left panel to accept it, invite other staff,
                  or resolve the case.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
