import type { WebsiteAssistantActionType } from "@/lib/websiteAssistantApi";

export type AssistantActionMode = "ask_permission" | "full_access";

export const DEFAULT_ASSISTANT_MODE: AssistantActionMode = "ask_permission";
export const ASSISTANT_MODE_STORAGE_KEY = "jp-website-ai-assistant-mode";

export const ASSISTANT_MODE_OPTIONS = [
  {
    value: "ask_permission",
    label: "Ask permission",
    description: "The assistant asks before opening pages or starting actions.",
  },
  {
    value: "full_access",
    label: "Full access",
    description: "The assistant can open pages and start safe flows automatically.",
  },
] as const satisfies ReadonlyArray<{
  value: AssistantActionMode;
  label: string;
  description: string;
}>;

export const SAFE_ACTION_TYPES = new Set<WebsiteAssistantActionType>([
  "OPEN_ROUTE",
  "START_LINE_CONNECT",
  "ESCALATE_SUPPORT",
  "OPEN_PRODUCT",
  "OPEN_SUPPORT_PAGE",
  "OPEN_CONTACT_PAGE",
]);

export const SAFE_ROUTES = {
  contact: "/contactus",
  support: "/contactus",
  profile: "/profile",
  profileSecurity: "/profile/security",
  appointments: "/appointment",
  lineConnect: "/line/connect-option",
  products: "/products",
} as const;

export const SAFE_STATIC_ROUTE_SET = new Set<string>(Object.values(SAFE_ROUTES));

export const SAFE_ROUTE_BUTTON_LABELS: Record<string, string> = {
  [SAFE_ROUTES.contact]: "Open Contact Page",
  [SAFE_ROUTES.profile]: "Open Profile Page",
  [SAFE_ROUTES.profileSecurity]: "Open Security Settings",
  [SAFE_ROUTES.appointments]: "Open Appointments",
  [SAFE_ROUTES.lineConnect]: "Open LINE Connect",
  [SAFE_ROUTES.products]: "Open Products",
};

export const SAFE_ROUTE_STATUS_TEXT: Record<string, string> = {
  [SAFE_ROUTES.contact]: "Opened contact page",
  [SAFE_ROUTES.profile]: "Opened profile page",
  [SAFE_ROUTES.profileSecurity]: "Opened profile security page",
  [SAFE_ROUTES.appointments]: "Opened appointments page",
  [SAFE_ROUTES.lineConnect]: "Opened LINE connect page",
  [SAFE_ROUTES.products]: "Opened products page",
};

export const normalizeAssistantMode = (value: unknown): AssistantActionMode =>
  value === "full_access" ? "full_access" : DEFAULT_ASSISTANT_MODE;
