import { resolveSafeReturnTo } from "@/lib/authRedirect";
import { startLineOAuth } from "@/lib/lineAuth";
import type { WebsiteAssistantAction } from "@/lib/websiteAssistantApi";
import {
  SAFE_ACTION_TYPES,
  SAFE_ROUTES,
  SAFE_ROUTE_BUTTON_LABELS,
  SAFE_ROUTE_STATUS_TEXT,
  SAFE_STATIC_ROUTE_SET,
} from "@/lib/assistant/assistantActionConfig";

const APP_ORIGIN = "https://jade-palace.local";

type RouteActionPlan = {
  kind: "route";
  route: string;
  buttonLabel: string;
  pendingText: string;
  successText: string;
};

type LineConnectActionPlan = {
  kind: "line_connect";
  returnTo: string;
  buttonLabel: string;
  pendingText: string;
  successText: string;
};

export type AssistantActionExecutionPlan =
  | RouteActionPlan
  | LineConnectActionPlan;

const asTrimmedString = (value: string | null | undefined) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

const toAppRelativeUrl = (value: string | null | undefined) => {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized, APP_ORIGIN);
    return url.origin === APP_ORIGIN ? url : null;
  } catch {
    return null;
  }
};

const buildRelativeRoute = (url: URL) => `${url.pathname}${url.search}${url.hash}`;

const resolveSafeStaticRoute = (value: string | null | undefined) => {
  const url = toAppRelativeUrl(value);
  if (!url || !SAFE_STATIC_ROUTE_SET.has(url.pathname)) {
    return null;
  }

  return buildRelativeRoute(url);
};

export const isSafeAssistantProductRoute = (value: string | null | undefined) => {
  const url = toAppRelativeUrl(value);
  if (!url) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "products" || !segments[1]) {
    return null;
  }

  return buildRelativeRoute(url);
};

const resolveLineConnectReturnTo = ({
  route,
  currentPath,
}: {
  route: string | null | undefined;
  currentPath: string;
}) => {
  const safeCurrentPath = resolveSafeReturnTo(currentPath) || SAFE_ROUTES.profile;
  const url = toAppRelativeUrl(route);

  if (!url || url.pathname !== SAFE_ROUTES.lineConnect) {
    return safeCurrentPath;
  }

  return resolveSafeReturnTo(url.searchParams.get("returnTo")) || safeCurrentPath;
};

const getRouteButtonLabel = (route: string, fallbackLabel: string | null) =>
  fallbackLabel || SAFE_ROUTE_BUTTON_LABELS[new URL(route, APP_ORIGIN).pathname] || "Open Page";

const getRouteStatusText = (route: string) =>
  SAFE_ROUTE_STATUS_TEXT[new URL(route, APP_ORIGIN).pathname] || "Opened page";

export const getAssistantActionExecutionPlan = ({
  action,
  currentPath,
}: {
  action: WebsiteAssistantAction;
  currentPath: string;
}): AssistantActionExecutionPlan | null => {
  if (!SAFE_ACTION_TYPES.has(action.type)) {
    return null;
  }

  const fallbackLabel = asTrimmedString(action.label);

  switch (action.type) {
    case "OPEN_ROUTE": {
      const route = resolveSafeStaticRoute(action.route);
      if (!route) {
        return null;
      }

      return {
        kind: "route",
        route,
        buttonLabel: getRouteButtonLabel(route, fallbackLabel),
        pendingText: "Opening page...",
        successText: getRouteStatusText(route),
      };
    }
    case "OPEN_PRODUCT": {
      const route = isSafeAssistantProductRoute(action.productRoute || action.route);
      if (!route) {
        return null;
      }

      return {
        kind: "route",
        route,
        buttonLabel: fallbackLabel || "View Product",
        pendingText: "Opening product...",
        successText: "Opened product",
      };
    }
    case "START_LINE_CONNECT":
      return {
        kind: "line_connect",
        returnTo: resolveLineConnectReturnTo({
          route: action.route,
          currentPath,
        }),
        buttonLabel: fallbackLabel || "Connect LINE",
        pendingText: "Starting LINE connection...",
        successText: "Started LINE connection",
      };
    case "ESCALATE_SUPPORT":
    case "OPEN_SUPPORT_PAGE":
    case "OPEN_CONTACT_PAGE": {
      const route = SAFE_ROUTES.contact;

      return {
        kind: "route",
        route,
        buttonLabel: fallbackLabel || "Open Contact Page",
        pendingText: "Opening contact page...",
        successText: getRouteStatusText(route),
      };
    }
    default:
      return null;
  }
};

export const executeAssistantActionPlan = async (
  plan: AssistantActionExecutionPlan,
  {
    navigate,
  }: {
    navigate: (route: string) => void;
  },
) => {
  if (plan.kind === "route") {
    navigate(plan.route);
    return;
  }

  await startLineOAuth({
    intent: "connect",
    returnTo: plan.returnTo,
  });
};
