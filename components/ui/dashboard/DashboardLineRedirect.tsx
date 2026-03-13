"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import {
  getStaffLineConversations,
  getStaffLineSupportRequests,
  type LineConversationSummary,
  type LineSupportRequestRecord,
  normalizeLineConversationPayload,
  normalizeLineMessagePayload,
  resolveRealtimeApiOrigin,
} from "@/lib/lineMessagingApi";
import supabase from "@/lib/supabase";
import { useRole } from "./RoleContext";

const LINE_REDIRECT_POLL_INTERVAL_MS = 8000;

const getLatestSupportCustomerActivity = (record: LineSupportRequestRecord) =>
  [...record.activities]
    .filter((activity) => activity.type === "CUSTOMER_MESSAGE")
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
    )[0] || null;

export default function DashboardLineRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dashboardBasePath, role, userId } = useRole();
  const socketRef = useRef<Socket | null>(null);
  const lastRedirectedMessageIdRef = useRef("");
  const conversationStateRef = useRef<Record<string, string>>({});
  const supportRequestStateRef = useRef<Record<string, string>>({});
  const pollInitializedRef = useRef(false);
  const supportPollInitializedRef = useRef(false);

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

  const routeToConversation = useEffectEvent((
    conversation: LineConversationSummary,
    messageId: string | null,
  ) => {
    const redirectKey = `conversation:${conversation.id}:${messageId || ""}`;
    if (lastRedirectedMessageIdRef.current === redirectKey) {
      return;
    }

    const targetHref = `${dashboardBasePath}/line?conversationId=${encodeURIComponent(
      conversation.id,
    )}`;
    const currentConversationId = searchParams.get("conversationId")?.trim() || "";
    const currentSupportRequestId = searchParams.get("supportRequestId")?.trim() || "";
    const onTargetPage =
      pathname === `${dashboardBasePath}/line` &&
      currentConversationId === conversation.id &&
      !currentSupportRequestId;

    if (onTargetPage) {
      lastRedirectedMessageIdRef.current = redirectKey;
      return;
    }

    lastRedirectedMessageIdRef.current = redirectKey;
    router.push(targetHref);
  });

  const routeToSupportConversation = useEffectEvent((supportRequestId: string, activityId: string) => {
    const redirectKey = `support:${supportRequestId}:${activityId}`;
    if (lastRedirectedMessageIdRef.current === redirectKey) {
      return;
    }

    const targetHref = `${dashboardBasePath}/line?view=conversations&supportRequestId=${encodeURIComponent(
      supportRequestId,
    )}`;
    const currentSupportRequestId = searchParams.get("supportRequestId")?.trim() || "";
    const currentView = searchParams.get("view")?.trim().toLowerCase() || "conversations";
    const onTargetPage =
      pathname === `${dashboardBasePath}/line` &&
      currentView !== "support" &&
      currentSupportRequestId === supportRequestId;

    if (onTargetPage) {
      lastRedirectedMessageIdRef.current = redirectKey;
      return;
    }

    lastRedirectedMessageIdRef.current = redirectKey;
    router.push(targetHref);
  });

  const handleRealtimeMessage = useEffectEvent((payload: unknown) => {
    if (role !== "manager" && role !== "salesperson") {
      return;
    }

    const row =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const conversation = normalizeLineConversationPayload(row?.conversation);
    const message = normalizeLineMessagePayload(row?.message);

    if (!conversation || !message || message.senderType !== "CUSTOMER") {
      return;
    }

    conversationStateRef.current[conversation.id] = [
      conversation.lastMessageId || "",
      conversation.lastMessageSenderType || "",
      conversation.lastMessageAt || "",
    ].join(":");
    routeToConversation(conversation, message.id);
  });

  useEffect(() => {
    if (role !== "manager" && role !== "salesperson") {
      return;
    }

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
        socket.on("line:message-created", handleRealtimeMessage);
      } catch {
        // Ignore realtime setup failures here. The dedicated LINE page still shows status feedback.
      }
    };

    void connect();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [getAccessToken, role]);

  useEffect(() => {
    if (role !== "manager" && role !== "salesperson") {
      return;
    }

    pollInitializedRef.current = false;
    conversationStateRef.current = {};
    supportPollInitializedRef.current = false;
    supportRequestStateRef.current = {};

    let cancelled = false;

    const pollConversations = async () => {
      try {
        const accessToken = await getAccessToken();
        const response = await getStaffLineConversations({
          role,
          accessToken,
        });

        if (cancelled) {
          return;
        }

        const nextState: Record<string, string> = {};
        for (const conversation of response.records) {
          const stateKey = [
            conversation.lastMessageId || "",
            conversation.lastMessageSenderType || "",
            conversation.lastMessageAt || "",
          ].join(":");

          const previousState = conversationStateRef.current[conversation.id];
          nextState[conversation.id] = stateKey;

          if (
            pollInitializedRef.current &&
            previousState !== stateKey &&
            conversation.lastMessageSenderType === "CUSTOMER" &&
            conversation.lastMessageId
          ) {
            routeToConversation(conversation, conversation.lastMessageId);
          }
        }

        conversationStateRef.current = nextState;
        pollInitializedRef.current = true;
      } catch {
        // Ignore polling failures here. The LINE page handles its own error state.
      }
    };

    void pollConversations();
    const intervalId = window.setInterval(() => {
      void pollConversations();
    }, LINE_REDIRECT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [getAccessToken, role]);

  useEffect(() => {
    if (role !== "manager" && role !== "salesperson") {
      return;
    }

    supportPollInitializedRef.current = false;
    supportRequestStateRef.current = {};

    let cancelled = false;

    const pollSupportRequests = async () => {
      try {
        const accessToken = await getAccessToken();
        const response = await getStaffLineSupportRequests({
          role,
          accessToken,
        });

        if (cancelled) {
          return;
        }

        const nextState: Record<string, string> = {};
        for (const record of response.records) {
          if (
            record.status !== "ACCEPTED" ||
            record.acceptedByUserId !== userId
          ) {
            continue;
          }

          const latestCustomerActivity = getLatestSupportCustomerActivity(record);
          const stateKey = [
            latestCustomerActivity?.id || "",
            latestCustomerActivity?.createdAt || "",
            record.updatedAt || "",
          ].join(":");

          const previousState = supportRequestStateRef.current[record.id];
          nextState[record.id] = stateKey;

          if (
            supportPollInitializedRef.current &&
            latestCustomerActivity?.id &&
            previousState !== stateKey
          ) {
            routeToSupportConversation(record.id, latestCustomerActivity.id);
          }
        }

        supportRequestStateRef.current = nextState;
        supportPollInitializedRef.current = true;
      } catch {
        // Ignore polling failures here. The LINE page handles its own error state.
      }
    };

    void pollSupportRequests();
    const intervalId = window.setInterval(() => {
      void pollSupportRequests();
    }, LINE_REDIRECT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [getAccessToken, role, routeToSupportConversation, userId]);

  return null;
}
