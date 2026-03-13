"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import LineSupportQueue from "@/components/ui/dashboard/LineSupportQueue";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import { handleAccountAccessDeniedError } from "@/lib/apiClient";
import {
  getManagerAnalyticsBranches,
  type ManagerBranchAnalyticsRecord,
} from "@/lib/managerApi";
import {
  endStaffLineSession,
  getStaffLineConversations,
  getStaffLineMessages,
  getStaffLineSupportRequests,
  normalizeLineConversationPayload,
  normalizeLineMessagePayload,
  resolveRealtimeApiOrigin,
  sendStaffLineMessage,
  sendStaffLineSupportRequestMessage,
  type LineConversationSummary,
  type LineMessageRecord,
  type LineSupportRequestRecord,
} from "@/lib/lineMessagingApi";
import supabase from "@/lib/supabase";

type StaffLineRole = "manager" | "salesperson";
type LineInboxView = "conversations" | "support";

const LINE_POLL_INTERVAL_MS = 8000;

const getErrorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Unexpected error.";

const sortConversations = (rows: LineConversationSummary[]) =>
  [...rows].sort((left, right) => {
    const leftValue = left.lastMessageAt || left.updatedAt || left.createdAt || "";
    const rightValue = right.lastMessageAt || right.updatedAt || right.createdAt || "";
    return rightValue.localeCompare(leftValue);
  });

const upsertConversation = (
  rows: LineConversationSummary[],
  nextConversation: LineConversationSummary,
) => {
  const nextRows = rows.filter((row) => row.id !== nextConversation.id);
  nextRows.unshift(nextConversation);
  return sortConversations(nextRows);
};

const upsertMessage = (rows: LineMessageRecord[], nextMessage: LineMessageRecord) => {
  const nextRows = rows.filter((row) => row.id !== nextMessage.id);
  nextRows.push(nextMessage);
  return nextRows.sort((left, right) =>
    String(left.createdAt || "").localeCompare(String(right.createdAt || "")),
  );
};

const sortSupportConversations = (rows: LineSupportRequestRecord[]) =>
  [...rows].sort((left, right) => {
    const leftValue = left.updatedAt || left.acceptedAt || left.createdAt || "";
    const rightValue = right.updatedAt || right.acceptedAt || right.createdAt || "";
    return rightValue.localeCompare(leftValue);
  });

const formatListTimestamp = (value: string | null) => {
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

const formatMessageTimestamp = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSessionDeadline = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getConversationCustomerName = (conversation: LineConversationSummary) =>
  conversation.customerLineDisplayName ||
  conversation.customerDisplayName ||
  conversation.appointment?.customerName ||
  conversation.customerEmail ||
  "Customer";

const getConversationCustomerAvatar = (conversation: LineConversationSummary) =>
  conversation.customerLinePictureUrl || conversation.appointment?.previewImageUrl || null;

const getSupportCustomerName = (record: LineSupportRequestRecord) =>
  record.customerDisplayName || record.customerEmail || "Support customer";

const sortSupportActivitiesAscending = (
  activities: LineSupportRequestRecord["activities"],
) =>
  [...activities].sort((left, right) =>
    String(left.createdAt || "").localeCompare(String(right.createdAt || "")),
  );

const getSupportMessageActivities = (record: LineSupportRequestRecord) =>
  sortSupportActivitiesAscending(record.activities).filter(
    (activity) =>
      activity.type === "CUSTOMER_MESSAGE" || activity.type === "STAFF_MESSAGE",
  );

const getSupportLastPreview = (record: LineSupportRequestRecord) => {
  const latestMessage = [...record.activities].find(
    (activity) =>
      activity.type === "CUSTOMER_MESSAGE" || activity.type === "STAFF_MESSAGE",
  );

  return (
    latestMessage?.message ||
    record.commandText ||
    "Support request started from the LINE official account."
  );
};

const messageTone = (message: LineMessageRecord, currentUserId: string) => {
  if (message.senderType === "SYSTEM") {
    return {
      justify: "justify-center",
      bubble:
        "max-w-xl rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800",
      label: "System",
    };
  }

  if (message.senderType === "STAFF") {
    const ownMessage = message.senderUserId === currentUserId;
    return {
      justify: ownMessage ? "justify-end" : "justify-start",
      bubble: ownMessage
        ? "max-w-xl rounded-3xl rounded-br-md bg-emerald-600 px-4 py-3 text-white"
        : "max-w-xl rounded-3xl rounded-bl-md bg-slate-900 px-4 py-3 text-white",
      label: message.senderDisplayName || "Staff",
    };
  }

  return {
    justify: "justify-start",
    bubble:
      "max-w-xl rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-slate-900",
    label: message.senderDisplayName || "Customer",
  };
};

export default function LineInbox({
  role,
  initialConversationId = "",
  initialView = "conversations",
  initialSupportRequestId = "",
}: {
  role: StaffLineRole;
  initialConversationId?: string;
  initialView?: LineInboxView;
  initialSupportRequestId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useRole();
  const initialConversationIdRef = useRef(initialConversationId.trim());
  const initialSupportRequestIdRef = useRef(initialSupportRequestId.trim());
  const socketRef = useRef<Socket | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingSupportRequests, setLoadingSupportRequests] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingSupport, setSendingSupport] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composer, setComposer] = useState("");
  const [supportComposer, setSupportComposer] = useState("");
  const [activeView, setActiveView] = useState<LineInboxView>(
    initialView === "support" ? "support" : "conversations",
  );
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialConversationId.trim(),
  );
  const [selectedSupportRequestId, setSelectedSupportRequestId] = useState(
    initialSupportRequestId.trim(),
  );
  const [conversations, setConversations] = useState<LineConversationSummary[]>([]);
  const [supportRequests, setSupportRequests] = useState<LineSupportRequestRecord[]>(
    [],
  );
  const [messagesByConversationId, setMessagesByConversationId] = useState<
    Record<string, LineMessageRecord[]>
  >({});
  const [socketStatus, setSocketStatus] = useState(
    "Realtime offline · auto-refresh active",
  );
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);

  const ownedSupportRequests = useMemo(
    () =>
      sortSupportConversations(
        supportRequests.filter(
          (record) =>
            record.status === "ACCEPTED" && record.acceptedByUserId === userId,
        ),
      ),
    [supportRequests, userId],
  );

  const selectedConversation = useMemo(
    () => conversations.find((row) => row.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );
  const selectedSupportRequest = useMemo(
    () =>
      ownedSupportRequests.find((row) => row.id === selectedSupportRequestId) || null,
    [ownedSupportRequests, selectedSupportRequestId],
  );

  const selectedCustomerName = selectedConversation
    ? getConversationCustomerName(selectedConversation)
    : "Customer";
  const selectedCustomerAvatarUrl = selectedConversation
    ? getConversationCustomerAvatar(selectedConversation)
    : null;
  const selectedSessionDeadline = selectedConversation
    ? formatSessionDeadline(selectedConversation.sessionGraceEndsAt)
    : "";
  const selectedSessionIsEnding = Boolean(selectedConversation?.sessionEndedAt);
  const currentMessages = selectedConversationId
    ? messagesByConversationId[selectedConversationId] || []
    : [];
  const supportMessages = selectedSupportRequest
    ? getSupportMessageActivities(selectedSupportRequest)
    : [];
  const selectedSupportCustomerName = selectedSupportRequest
    ? getSupportCustomerName(selectedSupportRequest)
    : "Support customer";
  const listIsLoading =
    (loading && conversations.length === 0) ||
    (loadingSupportRequests && ownedSupportRequests.length === 0);

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

  const replaceLineRoute = useCallback(
    ({
      view,
      conversationId,
      supportRequestId,
    }: {
      view: LineInboxView;
      conversationId?: string;
      supportRequestId?: string;
    }) => {
      const query = new URLSearchParams();
      query.set("view", view);

      if (supportRequestId) {
        query.set("supportRequestId", supportRequestId);
      } else if (conversationId) {
        query.set("conversationId", conversationId);
      }

      router.replace(`${pathname}?${query.toString()}`);
    },
    [pathname, router],
  );

  const openConversationThread = useCallback(
    (conversationId: string) => {
      setActiveView("conversations");
      setSelectedSupportRequestId("");
      setSelectedConversationId(conversationId);
      replaceLineRoute({
        view: "conversations",
        conversationId,
      });
    },
    [replaceLineRoute],
  );

  const openSupportConversation = useCallback(
    (supportRequestId: string) => {
      setActiveView("conversations");
      setSelectedSupportRequestId(supportRequestId);
      setSupportComposer("");
      replaceLineRoute({
        view: "conversations",
        supportRequestId,
      });
    },
    [replaceLineRoute],
  );

  const openSupportQueue = useCallback(
    (supportRequestId = selectedSupportRequestId) => {
      setActiveView("support");
      replaceLineRoute({
        view: "support",
        ...(supportRequestId ? { supportRequestId } : {}),
      });
    },
    [replaceLineRoute, selectedSupportRequestId],
  );

  const openConversationsView = useCallback(() => {
    setActiveView("conversations");
    replaceLineRoute({
      view: "conversations",
      ...(selectedSupportRequestId
        ? { supportRequestId: selectedSupportRequestId }
        : selectedConversationId
          ? { conversationId: selectedConversationId }
          : {}),
    });
  }, [replaceLineRoute, selectedConversationId, selectedSupportRequestId]);

  const syncSelectedConversation = useCallback(
    (nextConversations: LineConversationSummary[]) => {
      setSelectedConversationId((current) => {
        if (current && nextConversations.some((row) => row.id === current)) {
          return current;
        }

        if (
          initialConversationIdRef.current &&
          nextConversations.some(
            (row) => row.id === initialConversationIdRef.current,
          )
        ) {
          return initialConversationIdRef.current;
        }

        return nextConversations[0]?.id || "";
      });
    },
    [],
  );

  useEffect(() => {
    initialConversationIdRef.current = initialConversationId.trim();
  }, [initialConversationId]);

  useEffect(() => {
    initialSupportRequestIdRef.current = initialSupportRequestId.trim();
  }, [initialSupportRequestId]);

  useEffect(() => {
    setActiveView(initialView === "support" ? "support" : "conversations");
  }, [initialView]);

  useEffect(() => {
    const nextSupportRequestId = initialSupportRequestId.trim();
    const nextConversationId = initialConversationId.trim();

    setSelectedSupportRequestId(nextSupportRequestId);
    if (nextConversationId) {
      setSelectedConversationId(nextConversationId);
    }
  }, [initialConversationId, initialSupportRequestId]);

  useEffect(() => {
    syncSelectedConversation(conversations);
  }, [conversations, syncSelectedConversation]);

  useEffect(() => {
    const availableIds = new Set(ownedSupportRequests.map((row) => row.id));
    const requestedId = initialSupportRequestIdRef.current;

    setSelectedSupportRequestId((current) => {
      if (current && availableIds.has(current)) {
        return current;
      }

      if (requestedId && availableIds.has(requestedId)) {
        return requestedId;
      }

      return current ? "" : current;
    });
  }, [ownedSupportRequests]);

  useEffect(() => {
    setSupportComposer("");
  }, [selectedSupportRequestId]);

  const loadBranchScope = useCallback(async () => {
    if (role !== "manager") {
      return;
    }

    try {
      const accessToken = await getAccessToken();
      const analytics = await getManagerAnalyticsBranches({ accessToken });
      const options = analytics.branches
        .map((row: ManagerBranchAnalyticsRecord) => row.branch)
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((branch) => ({
          id: branch.id,
          label: [branch.code, branch.name].filter(Boolean).join(" · ") || branch.id,
        }));

      setBranchOptions(options);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setBranchOptions([]);
      setError(getErrorMessage(caughtError));
    }
  }, [getAccessToken, role]);

  const loadConversations = useCallback(
    async (
      nextBranchId = branchId,
      options?: {
        quiet?: boolean;
      },
    ) => {
      const quiet = options?.quiet === true;
      if (!quiet) {
        setLoading(true);
        setError("");
      }

      try {
        const accessToken = await getAccessToken();
        const response = await getStaffLineConversations({
          role,
          accessToken,
          branchId: role === "manager" ? nextBranchId || undefined : undefined,
        });
        const nextRows = sortConversations(response.records);
        setConversations(nextRows);
        syncSelectedConversation(nextRows);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        if (!quiet) {
          setConversations([]);
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (!quiet) {
          setLoading(false);
        }
      }
    },
    [branchId, getAccessToken, role, syncSelectedConversation],
  );

  const loadSupportRequests = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true;
      if (!quiet) {
        setLoadingSupportRequests(true);
        setError("");
      }

      try {
        const accessToken = await getAccessToken();
        const response = await getStaffLineSupportRequests({
          role,
          accessToken,
        });

        setSupportRequests(response.records);
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        if (!quiet) {
          setSupportRequests([]);
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (!quiet) {
          setLoadingSupportRequests(false);
        }
      }
    },
    [getAccessToken, role],
  );

  const loadMessages = useCallback(
    async (
      conversationId: string,
      options?: {
        quiet?: boolean;
      },
    ) => {
      if (!conversationId) {
        return;
      }

      const quiet = options?.quiet === true;
      if (!quiet) {
        setLoadingMessages(true);
        setError("");
      }

      try {
        const accessToken = await getAccessToken();
        const response = await getStaffLineMessages({
          role,
          accessToken,
          conversationId,
        });

        setMessagesByConversationId((current) => ({
          ...current,
          [conversationId]: response.records,
        }));

        if (response.conversation) {
          setConversations((current) =>
            upsertConversation(current, response.conversation as LineConversationSummary),
          );
        }
      } catch (caughtError) {
        if (handleAccountAccessDeniedError(caughtError)) {
          return;
        }

        if (!quiet) {
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (!quiet) {
          setLoadingMessages(false);
        }
      }
    },
    [getAccessToken, role],
  );

  useEffect(() => {
    void loadBranchScope();
  }, [loadBranchScope]);

  useEffect(() => {
    void loadConversations(branchId);
  }, [branchId, loadConversations]);

  useEffect(() => {
    void loadSupportRequests();
  }, [loadSupportRequests]);

  useEffect(() => {
    if (!selectedSupportRequestId && selectedConversationId) {
      void loadMessages(selectedConversationId);
    }
  }, [loadMessages, selectedConversationId, selectedSupportRequestId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadConversations(branchId, { quiet: true });
      void loadSupportRequests({ quiet: true });
      if (!selectedSupportRequestId && selectedConversationId) {
        void loadMessages(selectedConversationId, { quiet: true });
      }
    }, LINE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    branchId,
    loadConversations,
    loadMessages,
    loadSupportRequests,
    selectedConversationId,
    selectedSupportRequestId,
  ]);

  const handleRealtimeConversation = useEffectEvent((payload: unknown) => {
    const conversation = normalizeLineConversationPayload(payload);
    if (!conversation) {
      return;
    }

    if (role === "manager" && branchId && conversation.branchId !== branchId) {
      return;
    }

    setConversations((current) =>
      conversation.status === "OPEN"
        ? upsertConversation(current, conversation)
        : current.filter((row) => row.id !== conversation.id),
    );
  });

  const handleRealtimeMessage = useEffectEvent((payload: unknown) => {
    const row =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const conversation = normalizeLineConversationPayload(row?.conversation);
    const message = normalizeLineMessagePayload(row?.message);

    if (!conversation || !message) {
      return;
    }

    if (role === "manager" && branchId && conversation.branchId !== branchId) {
      return;
    }

    setConversations((current) => upsertConversation(current, conversation));
    setMessagesByConversationId((current) => ({
      ...current,
      [conversation.id]: upsertMessage(current[conversation.id] || [], message),
    }));
    setSelectedConversationId((current) => current || conversation.id);
  });

  useEffect(() => {
    let active = true;

    const connect = async () => {
      try {
        const accessToken = await getAccessToken();
        const realtimeOrigin = resolveRealtimeApiOrigin();

        if (!active || !realtimeOrigin) {
          return;
        }

        const socket = io(realtimeOrigin, {
          path: "/socket.io",
          auth: {
            token: accessToken,
          },
          transports: ["websocket", "polling"],
        });

        socketRef.current = socket;
        setSocketStatus("Realtime connecting");

        socket.on("connect", () => {
          if (!active) return;
          setSocketStatus("Realtime connected");
        });
        socket.on("disconnect", () => {
          if (!active) return;
          setSocketStatus("Realtime reconnecting · auto-refresh active");
        });
        socket.on("connect_error", (event) => {
          if (!active) return;
          setSocketStatus(
            event instanceof Error && event.message
              ? `Realtime unavailable: ${event.message} · auto-refresh active`
              : "Realtime unavailable · auto-refresh active",
          );
        });
        socket.on("line:ready", () => {
          if (!active) return;
          setSocketStatus("Realtime connected");
        });
        socket.on("line:conversation-upserted", handleRealtimeConversation);
        socket.on("line:message-created", handleRealtimeMessage);
      } catch {
        if (active) {
          setSocketStatus("Realtime unavailable · auto-refresh active");
        }
      }
    };

    void connect();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [getAccessToken, handleRealtimeConversation, handleRealtimeMessage]);

  const onSendMessage = async () => {
    const text = composer.trim();
    if (!selectedConversationId || !text) {
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await sendStaffLineMessage({
        role,
        accessToken,
        conversationId: selectedConversationId,
        text,
      });

      if (response.conversation) {
        setConversations((current) =>
          upsertConversation(current, response.conversation as LineConversationSummary),
        );
      }
      if (response.message) {
        setMessagesByConversationId((current) => ({
          ...current,
          [selectedConversationId]: upsertMessage(
            current[selectedConversationId] || [],
            response.message as LineMessageRecord,
          ),
        }));
      }

      setComposer("");
      setNotice("Message sent.");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setError(getErrorMessage(caughtError));
    } finally {
      setSending(false);
    }
  };

  const onEndSession = async () => {
    if (!selectedConversationId || selectedSessionIsEnding) {
      return;
    }

    setEndingSession(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await endStaffLineSession({
        role,
        accessToken,
        conversationId: selectedConversationId,
      });

      if (response.conversation) {
        setConversations((current) =>
          upsertConversation(current, response.conversation as LineConversationSummary),
        );
      }
      if (response.message) {
        setMessagesByConversationId((current) => ({
          ...current,
          [selectedConversationId]: upsertMessage(
            current[selectedConversationId] || [],
            response.message as LineMessageRecord,
          ),
        }));
      }

      setNotice("Session marked as ending. The customer can still reply for 3 days.");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setError(getErrorMessage(caughtError));
    } finally {
      setEndingSession(false);
    }
  };

  const onSendSupportMessage = async () => {
    const text = supportComposer.trim();
    if (!selectedSupportRequest || !text) {
      return;
    }

    setSendingSupport(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await sendStaffLineSupportRequestMessage({
        role,
        accessToken,
        supportRequestId: selectedSupportRequest.id,
        text,
      });

      if (response.record) {
        setSupportRequests((current) =>
          sortSupportConversations([
            response.record as LineSupportRequestRecord,
            ...current.filter((row) => row.id !== response.record?.id),
          ]),
        );
      }

      setSupportComposer("");
      setNotice("Support message sent.");
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setError(getErrorMessage(caughtError));
    } finally {
      setSendingSupport(false);
    }
  };

  const renderConversationSidebar = () => (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700/60">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Conversations
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Accepted support cases appear here alongside appointment LINE threads.
        </p>
      </div>

      {listIsLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : ownedSupportRequests.length === 0 && conversations.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          No LINE conversations are active yet.
        </div>
      ) : (
        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-3">
          {ownedSupportRequests.length > 0 ? (
            <section>
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Support
              </div>
              <div className="space-y-2">
                {ownedSupportRequests.map((record) => {
                  const isActive = record.id === selectedSupportRequestId;

                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => openSupportConversation(record.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-600/50 dark:bg-emerald-900/20"
                          : "border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white dark:bg-slate-800/70 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {getSupportCustomerName(record)}
                            </p>
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Support
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            {record.requestedLanguage
                              ? `Language: ${record.requestedLanguage}`
                              : "Language not specified"}
                          </p>
                          <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                            {getSupportLastPreview(record)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                          {formatListTimestamp(record.updatedAt || record.createdAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section>
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Customer Threads
            </div>
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                No appointment LINE threads are active right now.
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const isActive =
                    !selectedSupportRequest &&
                    conversation.id === selectedConversationId;
                  const customerName = getConversationCustomerName(conversation);
                  const customerAvatarUrl = getConversationCustomerAvatar(conversation);

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => openConversationThread(conversation.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-600/50 dark:bg-emerald-900/20"
                          : "border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white dark:bg-slate-800/70 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-700">
                          {customerAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={customerAvatarUrl}
                              alt={customerName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500 dark:text-slate-300">
                              {customerName[0]?.toUpperCase() || "C"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {customerName}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                {conversation.branch?.name || "Branch not set"}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                              {formatListTimestamp(
                                conversation.lastMessageAt || conversation.updatedAt,
                              )}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                            {conversation.lastMessagePreview ||
                              conversation.appointment?.notes ||
                              "Open the conversation to continue the LINE discussion."}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );

  const renderSupportConversationPane = () => {
    if (!selectedSupportRequest) {
      return null;
    }

    return (
      <div className="flex h-full min-h-[72vh] flex-col">
        <div className="border-b border-white/70 px-6 py-5 backdrop-blur dark:border-slate-700/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {selectedSupportCustomerName}
                </h2>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Support
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {selectedSupportRequest.customerEmail || "LINE support customer"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {selectedSupportRequest.requestedLanguage
                  ? `Requested language: ${selectedSupportRequest.requestedLanguage}`
                  : "Requested language not specified"}
                {selectedSupportRequest.acceptedAt
                  ? ` · accepted ${formatListTimestamp(selectedSupportRequest.acceptedAt)}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => openSupportQueue(selectedSupportRequest.id)}
                className="rounded-full bg-slate-900 px-3 py-1 font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Manage Case
              </button>
              {selectedSupportRequest.acceptedBy?.displayName ? (
                <span className="rounded-full bg-white/70 px-3 py-1 dark:bg-slate-800/70">
                  Owner: {selectedSupportRequest.acceptedBy.displayName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-white/70 bg-white/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Support Request
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
              {selectedSupportRequest.commandText || "/support"}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4">
            <div className="flex justify-start">
              <div className="max-w-xl rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <p className="mb-1 text-[11px] font-medium opacity-80">
                  {selectedSupportCustomerName}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {selectedSupportRequest.commandText || "/support"}
                </p>
                <p className="mt-2 text-[10px] opacity-70">
                  {formatMessageTimestamp(selectedSupportRequest.createdAt)}
                </p>
              </div>
            </div>

            {supportMessages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                Reply here to start the support discussion with the customer.
              </div>
            ) : (
              supportMessages.map((activity) => {
                const isStaffMessage = activity.type === "STAFF_MESSAGE";
                const isOwnStaffMessage =
                  isStaffMessage && activity.actorUserId === userId;

                return (
                  <div
                    key={activity.id}
                    className={`flex ${
                      isStaffMessage
                        ? isOwnStaffMessage
                          ? "justify-end"
                          : "justify-start"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={
                        isStaffMessage
                          ? isOwnStaffMessage
                            ? "max-w-xl rounded-3xl rounded-br-md bg-emerald-600 px-4 py-3 text-white"
                            : "max-w-xl rounded-3xl rounded-bl-md bg-slate-900 px-4 py-3 text-white dark:bg-slate-800"
                          : "max-w-xl rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      }
                    >
                      <p className="mb-1 text-[11px] font-medium opacity-80">
                        {isStaffMessage
                          ? activity.actorDisplayName || "Staff"
                          : selectedSupportCustomerName}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {activity.message}
                      </p>
                      <p className="mt-2 text-[10px] opacity-70">
                        {formatMessageTimestamp(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-white/70 bg-white/70 px-5 py-4 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/60">
          <div className="flex items-end gap-3">
            <textarea
              value={supportComposer}
              onChange={(event) => setSupportComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void onSendSupportMessage();
                }
              }}
              placeholder="Reply to the support customer..."
              rows={3}
              className="min-h-[96px] flex-1 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => void onSendSupportMessage()}
              disabled={sendingSupport || !supportComposer.trim()}
              className="rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingSupport ? "Sending..." : "Send"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Customer replies to this support case will keep redirecting staff back to this
            chat.
          </p>
        </div>
      </div>
    );
  };

  const renderAppointmentConversationPane = () => {
    if (!selectedConversation) {
      return null;
    }

    return (
      <div className="flex h-full min-h-[72vh] flex-col">
        <div className="border-b border-white/70 px-6 py-5 backdrop-blur dark:border-slate-700/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-3xl bg-white/80 shadow-sm dark:bg-slate-800/80">
                {selectedCustomerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedCustomerAvatarUrl}
                    alt={selectedCustomerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-slate-500 dark:text-slate-300">
                    {selectedCustomerName[0]?.toUpperCase() || "C"}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {selectedCustomerName}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedConversation.customerEmail || "LINE customer"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {!selectedSessionIsEnding ? (
                <button
                  type="button"
                  onClick={() => void onEndSession()}
                  disabled={endingSession}
                  className="rounded-full bg-slate-900 px-3 py-1 font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {endingSession ? "Ending..." : "End Session"}
                </button>
              ) : (
                <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Session ending
                </span>
              )}
              <span className="rounded-full bg-white/70 px-3 py-1 dark:bg-slate-800/70">
                Status: {selectedConversation.appointment?.status || "OPEN"}
              </span>
            </div>
          </div>

          {selectedSessionIsEnding ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
              Session has been ended by staff. The customer can still ask follow-up
              questions until {selectedSessionDeadline || "the grace period ends"}.
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadingMessages ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-3xl bg-white/80 dark:bg-slate-800/70"
                />
              ))}
            </div>
          ) : currentMessages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
              No messages yet. Send the first update to start the LINE thread.
            </div>
          ) : (
            <div className="space-y-4">
              {currentMessages.map((message) => {
                const tone = messageTone(message, userId);

                return (
                  <div key={message.id} className={`flex ${tone.justify}`}>
                    <div className={tone.bubble}>
                      {message.senderType !== "SYSTEM" ? (
                        <p className="mb-1 text-[11px] font-medium opacity-80">
                          {tone.label}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.text}
                      </p>
                      <p className="mt-2 text-[10px] opacity-70">
                        {formatMessageTimestamp(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-white/70 bg-white/70 px-5 py-4 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/60">
          <div className="flex items-end gap-3">
            <textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void onSendMessage();
                }
              }}
              placeholder="Send a LINE message to the customer..."
              rows={3}
              className="min-h-[96px] flex-1 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => void onSendMessage()}
              disabled={sending || !composer.trim()}
              className="rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Staff messages are delivered to the customer through the official LINE account.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="LINE"
        description={
          activeView === "support"
            ? "Manage live support requests triggered from LINE Official Account commands."
            : "Continue LINE conversations for appointments and accepted support cases."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
              {(["conversations", "support"] as LineInboxView[]).map((view) => {
                const isActive = activeView === view;

                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() =>
                      view === "support"
                        ? openSupportQueue(
                            selectedSupportRequestId ||
                              initialSupportRequestIdRef.current,
                          )
                        : openConversationsView()
                    }
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {view === "conversations" ? "Conversations" : "Support"}
                  </button>
                );
              })}
            </div>
            {activeView === "conversations" ? (
              <>
                {role === "manager" ? (
                  <select
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">All branches</option>
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void loadConversations(branchId);
                    void loadSupportRequests();
                  }}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Refresh
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {activeView === "support" ? (
        <LineSupportQueue
          role={role}
          currentUserId={userId}
          initialSupportRequestId={initialSupportRequestId}
          getAccessToken={getAccessToken}
        />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300">
            <span>{socketStatus}</span>
            <span>
              {ownedSupportRequests.length} support chats · {conversations.length} customer
              threads
            </span>
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
            {renderConversationSidebar()}
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] shadow-sm dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)]">
              {selectedSupportRequest ? (
                renderSupportConversationPane()
              ) : selectedConversation ? (
                renderAppointmentConversationPane()
              ) : (
                <div className="flex min-h-[72vh] items-center justify-center px-6">
                  <div className="max-w-md text-center">
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      Choose a conversation
                    </h2>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      Select a support chat or customer thread from the left panel to continue
                      the LINE discussion.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
