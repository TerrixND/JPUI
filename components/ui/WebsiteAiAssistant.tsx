"use client";

import {
  Bot,
  LoaderCircle,
  MessageCircleMore,
  RefreshCcw,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import AssistantModeSwitch from "@/components/ui/assistant/AssistantModeSwitch";
import AssistantProductResults from "@/components/ui/assistant/AssistantProductResults";
import {
  ASSISTANT_MODE_STORAGE_KEY,
  DEFAULT_ASSISTANT_MODE,
  normalizeAssistantMode,
  type AssistantActionMode,
} from "@/lib/assistant/assistantActionConfig";
import {
  executeAssistantActionPlan,
  getAssistantActionExecutionPlan,
} from "@/lib/assistant/assistantActionExecutor";
import {
  consumeWebsiteAssistantPendingAction,
  sendWebsiteAssistantMessage,
  type WebsiteAssistantAction,
  type WebsiteAssistantChatResponse,
  type WebsiteAssistantProductResultItem,
  type WebsiteAssistantUi,
} from "@/lib/websiteAssistantApi";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  mode: string | null;
  ui: WebsiteAssistantUi;
  action: WebsiteAssistantAction;
  pendingAction: WebsiteAssistantAction;
  suggestedFollowUps: string[];
};

type MessageActionStatus = {
  state: "executing" | "completed" | "failed";
  text: string;
};

const STORAGE_KEYS = {
  sessionId: "jp-website-ai-assistant-session-id",
  browserSessionId: "jp-website-ai-assistant-browser-session-id",
  open: "jp-website-ai-assistant-open",
  messages: "jp-website-ai-assistant-messages",
  mode: ASSISTANT_MODE_STORAGE_KEY,
} as const;

const DEFAULT_HANDOFF_COMMAND = "/support en";
const ACTION_FAILURE_MESSAGE = "I couldn't complete that action. Please try again.";

const EMPTY_UI: WebsiteAssistantUi = {
  type: "none",
  items: [],
};

const EMPTY_ACTION: WebsiteAssistantAction = {
  type: "NONE",
  route: null,
  productRoute: null,
  label: null,
  handoffCommand: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const asNullableString = (value: unknown) => {
  const normalized = asString(value).trim();
  return normalized || null;
};

const asNumberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const createLocalId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createBrowserSessionId = () => createLocalId("browser");

const normalizeUi = (value: unknown): WebsiteAssistantUi => {
  if (!isRecord(value) || asString(value.type).trim().toLowerCase() !== "product_results") {
    return EMPTY_UI;
  }

  const items = Array.isArray(value.items)
    ? value.items
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }

          const id = asString(entry.id).trim();
          const name = asString(entry.name).trim();
          if (!id || !name) {
            return null;
          }

          return {
            id,
            name,
            shortDescription: asString(entry.shortDescription).trim(),
            mediaPreviewUrl: asNullableString(entry.mediaPreviewUrl),
            productRoute: asNullableString(entry.productRoute),
            productType: asNullableString(entry.productType),
            shape: asNullableString(entry.shape),
            color: asNullableString(entry.color),
            weightCarat: asNumberOrNull(entry.weightCarat),
            weightGram: asNumberOrNull(entry.weightGram),
            hasCertificate: entry.hasCertificate === true,
          } satisfies WebsiteAssistantProductResultItem;
        })
        .filter((entry): entry is WebsiteAssistantProductResultItem => Boolean(entry))
    : [];

  if (items.length === 0) {
    return EMPTY_UI;
  }

  return {
    type: "product_results",
    items,
  };
};

const normalizeAction = (value: unknown): WebsiteAssistantAction => {
  if (!isRecord(value)) {
    return EMPTY_ACTION;
  }

  const type = asString(value.type).trim().toUpperCase();
  if (
    type !== "OPEN_ROUTE" &&
    type !== "START_LINE_CONNECT" &&
    type !== "ESCALATE_SUPPORT" &&
    type !== "OPEN_PRODUCT" &&
    type !== "OPEN_SUPPORT_PAGE" &&
    type !== "OPEN_CONTACT_PAGE"
  ) {
    return EMPTY_ACTION;
  }

  return {
    type,
    route: asNullableString(value.route),
    productRoute: asNullableString(value.productRoute),
    label: asNullableString(value.label),
    handoffCommand: asNullableString(value.handoffCommand),
  };
};

const createMessage = (
  role: ChatRole,
  text: string,
  extras?: Partial<Omit<ChatMessage, "id" | "role" | "text" | "createdAt">>,
): ChatMessage => ({
  id: createLocalId(role),
  role,
  text,
  createdAt: new Date().toISOString(),
  mode: extras?.mode || null,
  ui: extras?.ui || EMPTY_UI,
  action: extras?.action || EMPTY_ACTION,
  pendingAction: extras?.pendingAction || EMPTY_ACTION,
  suggestedFollowUps: Array.isArray(extras?.suggestedFollowUps)
    ? extras.suggestedFollowUps.filter(Boolean)
    : [],
});

const createGreetingMessage = (handoffCommand = DEFAULT_HANDOFF_COMMAND) =>
  createMessage(
    "assistant",
    "Hello. I can help with products, appointments, account pages, LINE connection, and human support.",
  );

const normalizeStoredMessage = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) {
    return null;
  }

  const role = value.role === "assistant" || value.role === "user" ? value.role : null;
  const text = asString(value.text).trim();

  if (!role || !text) {
    return null;
  }

  return {
    id: asString(value.id).trim() || createLocalId(role),
    role,
    text,
    createdAt: asString(value.createdAt).trim() || new Date().toISOString(),
    mode: asNullableString(value.mode),
    ui: normalizeUi(value.ui),
    action: normalizeAction(value.action),
    pendingAction: normalizeAction(value.pendingAction),
    suggestedFollowUps: Array.isArray(value.suggestedFollowUps)
      ? value.suggestedFollowUps
          .map((entry) => asString(entry).trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
  };
};

const parseStoredMessages = (raw: string | null) => {
  if (!raw) {
    return [createGreetingMessage()];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const messages = Array.isArray(parsed)
      ? parsed
          .map((entry) => normalizeStoredMessage(entry))
          .filter((entry): entry is ChatMessage => Boolean(entry))
      : [];

    return messages.length > 0 ? messages : [createGreetingMessage()];
  } catch {
    return [createGreetingMessage()];
  }
};

const parseStoredBoolean = (raw: string | null) => {
  if (!raw) {
    return false;
  }

  try {
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
};

const resizeComposer = (element: HTMLTextAreaElement | null) => {
  if (!element) {
    return;
  }

  element.style.height = "0px";
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
};

const readStorageItem = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageItem = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
};

const removeStorageItem = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
};

const createAssistantMessageFromResponse = (
  response: WebsiteAssistantChatResponse,
): ChatMessage =>
  createMessage("assistant", response.message, {
    mode: response.mode,
    ui: response.ui,
    action: response.action,
    pendingAction: response.pendingAction,
    suggestedFollowUps: response.suggestedFollowUps,
  });

const getActionStatusClasses = (state: MessageActionStatus["state"]) => {
  switch (state) {
    case "completed":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border border-stone-200 bg-stone-100 text-stone-600";
  }
};

export default function WebsiteAiAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const isMountedRef = useRef(true);
  const assistantModeRef = useRef<AssistantActionMode>(DEFAULT_ASSISTANT_MODE);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [assistantMode, setAssistantMode] =
    useState<AssistantActionMode>(DEFAULT_ASSISTANT_MODE);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [browserSessionId, setBrowserSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createGreetingMessage()]);
  const [actionStatuses, setActionStatuses] = useState<Record<string, MessageActionStatus>>({});
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [latestHandoffCommand, setLatestHandoffCommand] = useState(DEFAULT_HANDOFF_COMMAND);

  useEffect(() => {
    const storedSessionId = asNullableString(readStorageItem(STORAGE_KEYS.sessionId));
    const storedBrowserSessionId =
      asNullableString(readStorageItem(STORAGE_KEYS.browserSessionId)) ||
      createBrowserSessionId();

    setSessionId(storedSessionId);
    setBrowserSessionId(storedBrowserSessionId);
    setIsOpen(parseStoredBoolean(readStorageItem(STORAGE_KEYS.open)));
    setMessages(parseStoredMessages(readStorageItem(STORAGE_KEYS.messages)));
    setAssistantMode(normalizeAssistantMode(readStorageItem(STORAGE_KEYS.mode)));
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    assistantModeRef.current = assistantMode;
  }, [assistantMode]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (sessionId) {
      writeStorageItem(STORAGE_KEYS.sessionId, sessionId);
    } else {
      removeStorageItem(STORAGE_KEYS.sessionId);
    }

    if (browserSessionId) {
      writeStorageItem(STORAGE_KEYS.browserSessionId, browserSessionId);
    } else {
      removeStorageItem(STORAGE_KEYS.browserSessionId);
    }

    writeStorageItem(STORAGE_KEYS.open, JSON.stringify(isOpen));
    writeStorageItem(STORAGE_KEYS.messages, JSON.stringify(messages));
    writeStorageItem(STORAGE_KEYS.mode, assistantMode);
  }, [assistantMode, browserSessionId, hasHydrated, isOpen, messages, sessionId]);

  useEffect(() => {
    resizeComposer(composerRef.current);
  }, [draft]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const viewport = messageViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [isLoading, isOpen, messages]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: WindowEventMap["keydown"]) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestAbortRef.current?.abort();
    };
  }, []);

  const appendSystemMessage = (text: string) => {
    setMessages((currentMessages) => [...currentMessages, createMessage("assistant", text)]);
  };

  const executeActionForMessage = async (
    message: ChatMessage,
    options?: {
      sessionId?: string | null;
      browserSessionId?: string | null;
    },
  ) => {
    const plan = getAssistantActionExecutionPlan({
      action: message.action,
      currentPath: pathname,
    });

    if (!plan) {
      setActionStatuses((currentStatuses) => ({
        ...currentStatuses,
        [message.id]: {
          state: "failed",
          text: "Action unavailable",
        },
      }));
      appendSystemMessage(ACTION_FAILURE_MESSAGE);
      return;
    }

    setActionStatuses((currentStatuses) => ({
      ...currentStatuses,
      [message.id]: {
        state: "executing",
        text: plan.pendingText,
      },
    }));

    try {
      await executeAssistantActionPlan(plan, {
        navigate: (route) => router.push(route),
      });

      if (!isMountedRef.current) {
        return;
      }

      setActionStatuses((currentStatuses) => ({
        ...currentStatuses,
        [message.id]: {
          state: "completed",
          text: plan.successText,
        },
      }));

      if (message.pendingAction.type !== "NONE") {
        await consumeWebsiteAssistantPendingAction({
          sessionId: options?.sessionId || sessionId,
          browserSessionId: options?.browserSessionId || browserSessionId,
        }).catch(() => {
          return;
        });
      }
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      setActionStatuses((currentStatuses) => ({
        ...currentStatuses,
        [message.id]: {
          state: "failed",
          text: "Action failed",
        },
      }));
      appendSystemMessage(ACTION_FAILURE_MESSAGE);
    }
  };

  const submitMessage = async (
    messageText: string,
    options?: {
      appendUserMessage?: boolean;
    },
  ) => {
    const normalizedMessage = messageText.trim();

    if (!normalizedMessage || isLoading) {
      return;
    }

    const shouldAppendUserMessage = options?.appendUserMessage !== false;
    const activeBrowserSessionId = browserSessionId || createBrowserSessionId();

    requestAbortRef.current?.abort();
    requestAbortRef.current = new AbortController();

    if (!browserSessionId) {
      setBrowserSessionId(activeBrowserSessionId);
    }

    setError(null);
    setIsOpen(true);
    setIsLoading(true);
    setLastSubmittedMessage(normalizedMessage);

    if (shouldAppendUserMessage) {
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("user", normalizedMessage),
      ]);
      setDraft("");
    }

    try {
      const response = await sendWebsiteAssistantMessage(
        {
          message: normalizedMessage,
          sessionId,
          browserSessionId: activeBrowserSessionId,
          pagePath: pathname,
        },
        {
          signal: requestAbortRef.current.signal,
        },
      );

      const nextBrowserSessionId =
        response.browserSessionId?.trim() || activeBrowserSessionId;

      if (!isMountedRef.current) {
        return;
      }

      const assistantMessage = createAssistantMessageFromResponse(response);

      setSessionId(response.sessionId);
      setBrowserSessionId(nextBrowserSessionId);
      setLatestHandoffCommand(response.handoffCommand || DEFAULT_HANDOFF_COMMAND);
      setMessages((currentMessages) => [...currentMessages, assistantMessage]);

      const shouldAutoExecute =
        assistantMessage.action.type !== "NONE" &&
        (
          assistantModeRef.current === "full_access" ||
          assistantMessage.mode === "action_confirmation"
        );

      if (shouldAutoExecute) {
        void executeActionForMessage(assistantMessage, {
          sessionId: response.sessionId,
          browserSessionId: nextBrowserSessionId,
        });
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reach the assistant right now.",
      );
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      requestAbortRef.current = null;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage(draft);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submitMessage(draft);
  };

  const handleNewChat = () => {
    if (isLoading) {
      return;
    }

    setError(null);
    setSessionId(null);
    setBrowserSessionId(createBrowserSessionId());
    setMessages([createGreetingMessage(latestHandoffCommand)]);
    setActionStatuses({});
    setDraft("");
    setLastSubmittedMessage(null);
    setIsOpen(true);
  };

  const handleRetry = () => {
    if (!lastSubmittedMessage || isLoading) {
      return;
    }

    void submitMessage(lastSubmittedMessage, {
      appendUserMessage: false,
    });
  };

  const showSupportHint =
    messages.filter((message) => message.role === "user").length === 0 && !isLoading;

  return (
    <div className="fixed bottom-4 right-4 z-[120] flex items-end justify-end sm:bottom-6 sm:right-6">
      {isOpen ? (
        <section
          aria-label="Website assistant"
          className="jp-fade-in-up flex h-[min(42rem,calc(100dvh-1rem))] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[1.75rem] border border-stone-200/80 bg-white/95 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur"
          role="dialog"
        >
          <div className="relative overflow-hidden border-b border-stone-200/80 px-4 py-4 sm:px-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(5,150,105,0.16),transparent_42%),linear-gradient(180deg,rgba(250,250,249,0.98),rgba(255,255,255,0.98))]" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
                  <Bot className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-500">
                    Jade Palace
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-stone-950">
                    Website Assistant
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Product discovery, support guidance, and safe in-app actions.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    aria-label="Start a new chat"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading}
                    onClick={handleNewChat}
                    type="button"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Close assistant"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <AssistantModeSwitch
                onChange={setAssistantMode}
                value={assistantMode}
              />
            </div>
          </div>

          <div
            ref={messageViewportRef}
            className="scrollbar-hide flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(250,250,249,0.9),rgba(255,255,255,1))] px-3 py-4 sm:px-4"
          >
            <div className="space-y-3">
              {messages.map((message) => {
                const isAssistant = message.role === "assistant";
                const actionStatus = actionStatuses[message.id];
                const actionPlan = getAssistantActionExecutionPlan({
                  action: message.action,
                  currentPath: pathname,
                });
                const showActionButton =
                  Boolean(actionPlan) &&
                  actionStatus?.state !== "executing" &&
                  actionStatus?.state !== "completed" &&
                  (
                    (
                      assistantMode === "ask_permission" &&
                      message.mode !== "action_confirmation"
                    ) ||
                    actionStatus?.state === "failed"
                  );

                return (
                  <div
                    key={message.id}
                    className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[92%] ${isAssistant ? "" : "w-auto"}`}>
                      <div
                        className={`rounded-[1.4rem] px-4 py-3 text-sm leading-6 shadow-sm ${
                          isAssistant
                            ? "rounded-bl-md border border-stone-200 bg-white text-stone-800"
                            : "rounded-br-md bg-black text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.text}</p>
                      </div>

                      {isAssistant && message.ui.type === "product_results" ? (
                        <AssistantProductResults items={message.ui.items} />
                      ) : null}

                      {isAssistant && actionStatus ? (
                        <div className="mt-3">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium ${getActionStatusClasses(actionStatus.state)}`}
                          >
                            {actionStatus.text}
                          </span>
                        </div>
                      ) : null}

                      {isAssistant && showActionButton && actionPlan ? (
                        <div className="mt-3">
                          <button
                            className="inline-flex items-center rounded-full border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isLoading}
                            onClick={() =>
                              void executeActionForMessage(message, {
                                sessionId,
                                browserSessionId,
                              })}
                            type="button"
                          >
                            {actionPlan.buttonLabel}
                          </button>
                        </div>
                      ) : null}

                      {isAssistant && message.suggestedFollowUps.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestedFollowUps.map((followUp) => (
                            <button
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isLoading}
                              key={followUp}
                              onClick={() => void submitMessage(followUp)}
                              type="button"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              {followUp}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-[1.4rem] rounded-bl-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 shadow-sm">
                    <div className="flex items-center gap-3">
                      <LoaderCircle className="h-4 w-4 animate-spin text-emerald-700" />
                      <span>Thinking</span>
                      <div className="flex items-center gap-1">
                        <span className="jp-dot-1 h-1.5 w-1.5 rounded-full bg-stone-400" />
                        <span className="jp-dot-2 h-1.5 w-1.5 rounded-full bg-stone-400" />
                        <span className="jp-dot-3 h-1.5 w-1.5 rounded-full bg-stone-400" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <form
            className="border-t border-stone-200/80 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 sm:px-4"
            onSubmit={handleSubmit}
          >
            {error ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <div className="flex items-start justify-between gap-3">
                  <p className="leading-5">{error}</p>
                  {lastSubmittedMessage ? (
                    <button
                      className="shrink-0 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                      onClick={handleRetry}
                      type="button"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showSupportHint ? (
              <p className="mb-3 text-xs leading-5 text-stone-500">
                Need a person? Tell me you want staff support and I can guide or connect you.
              </p>
            ) : null}

            <div className="flex items-end gap-3 rounded-[1.4rem] border border-stone-200 bg-stone-50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition focus-within:border-emerald-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100">
              <textarea
                ref={composerRef}
                className="max-h-40 min-h-[24px] w-full resize-none bg-transparent text-sm leading-6 text-stone-900 outline-none placeholder:text-stone-400"
                disabled={!hasHydrated || isLoading}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask about products, appointments, profile steps, or support..."
                rows={1}
                value={draft}
              />

              <button
                aria-label="Send message"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-300"
                disabled={!hasHydrated || isLoading || !draft.trim()}
                type="submit"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button
          aria-expanded={false}
          aria-label="Open website assistant"
          className="group flex items-center gap-3 rounded-full bg-black px-3 py-3 text-left text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] transition hover:bg-emerald-900 sm:px-4"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12">
            <MessageCircleMore className="h-5 w-5" />
          </span>
          <span className="hidden pr-1 sm:block">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">
              AI Assistant
            </span>
            <span className="mt-0.5 block text-sm font-medium text-white">
              Need help?
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
