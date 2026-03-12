"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import {
  getStaffLineConversations,
  type LineConversationSummary,
  normalizeLineConversationPayload,
  normalizeLineMessagePayload,
  resolveRealtimeApiOrigin,
} from "@/lib/lineMessagingApi";
import supabase from "@/lib/supabase";
import { useRole } from "./RoleContext";

const LINE_REDIRECT_POLL_INTERVAL_MS = 8000;

export default function DashboardLineRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dashboardBasePath, role } = useRole();
  const socketRef = useRef<Socket | null>(null);
  const lastRedirectedMessageIdRef = useRef("");
  const conversationStateRef = useRef<Record<string, string>>({});
  const pollInitializedRef = useRef(false);

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
    if (messageId && lastRedirectedMessageIdRef.current === messageId) {
      return;
    }

    const targetHref = `${dashboardBasePath}/line?conversationId=${encodeURIComponent(
      conversation.id,
    )}`;
    const currentConversationId = searchParams.get("conversationId")?.trim() || "";
    const onTargetPage =
      pathname === `${dashboardBasePath}/line` && currentConversationId === conversation.id;

    if (onTargetPage) {
      lastRedirectedMessageIdRef.current = messageId || "";
      return;
    }

    lastRedirectedMessageIdRef.current = messageId || "";
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

  return null;
}
