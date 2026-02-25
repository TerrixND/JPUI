import type { AdminUserAccessRestriction } from "@/lib/apiClient";

export const ADMIN_ACTION_BLOCKS = [
  "PRODUCT_CREATE",
  "PRODUCT_EDIT",
  "PRODUCT_DELETE",
  "INVENTORY_REQUEST_DECIDE",
  "USER_ACCESS_MANAGE",
  "APPROVAL_REVIEW",
  "STAFF_RULE_MANAGE",
] as const;

export type AdminActionBlock = (typeof ADMIN_ACTION_BLOCKS)[number];
export type AdminRestrictionMode = "ACCOUNT" | "ADMIN_ACTIONS";

export type AdminActionControl = {
  id: string;
  reason: string | null;
  note: string | null;
  startsAt: string | null;
  endsAt: string | null;
  actions: AdminActionBlock[];
};

export type AdminCapabilityState = {
  blockedActions: Set<AdminActionBlock>;
  activeControls: AdminActionControl[];
};

const adminActionBlockSet = new Set<string>(ADMIN_ACTION_BLOCKS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeRestrictionMode = (value: unknown): AdminRestrictionMode | null => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "ACCOUNT" || normalized === "ADMIN_ACTIONS") {
    return normalized;
  }

  return null;
};

const normalizeActionBlock = (value: unknown): AdminActionBlock | null => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!normalized || !adminActionBlockSet.has(normalized)) {
    return null;
  }

  return normalized as AdminActionBlock;
};

const parseAdminActionBlocks = (value: unknown): AdminActionBlock[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const dedupe = new Set<AdminActionBlock>();
  for (const raw of rawValues) {
    const normalized = normalizeActionBlock(raw);
    if (normalized) {
      dedupe.add(normalized);
    }
  }

  return Array.from(dedupe);
};

export const createEmptyAdminCapabilityState = (): AdminCapabilityState => ({
  blockedActions: new Set<AdminActionBlock>(),
  activeControls: [],
});

export const buildAdminCapabilityState = (
  activeAccessControls: AdminUserAccessRestriction[] | null | undefined,
): AdminCapabilityState => {
  const state = createEmptyAdminCapabilityState();

  if (!Array.isArray(activeAccessControls)) {
    return state;
  }

  for (const control of activeAccessControls) {
    if (!control || control.isActive !== true) {
      continue;
    }

    const metadata = isRecord(control.metadata) ? control.metadata : null;
    const raw = isRecord(control.raw) ? control.raw : null;

    const restrictionMode = normalizeRestrictionMode(
      metadata?.restrictionMode ?? raw?.restrictionMode,
    );

    if (restrictionMode !== "ADMIN_ACTIONS") {
      continue;
    }

    const actions = parseAdminActionBlocks(
      metadata?.adminActionBlocks ??
        metadata?.actionBlocks ??
        raw?.adminActionBlocks ??
        raw?.actionBlocks,
    );

    if (!actions.length) {
      continue;
    }

    for (const action of actions) {
      state.blockedActions.add(action);
    }

    state.activeControls.push({
      id: control.id,
      reason: control.reason,
      note: control.note,
      startsAt: control.startsAt,
      endsAt: control.endsAt,
      actions,
    });
  }

  return state;
};

export const getAdminActionRestrictionTooltip = (action: AdminActionBlock) => {
  switch (action) {
    case "PRODUCT_CREATE":
      return "You are restricted from creating products.";
    case "PRODUCT_EDIT":
      return "You are restricted from editing products.";
    case "PRODUCT_DELETE":
      return "You are restricted from deleting products.";
    case "INVENTORY_REQUEST_DECIDE":
      return "You are restricted from deciding inventory requests.";
    case "USER_ACCESS_MANAGE":
      return "You are restricted from managing user access.";
    case "APPROVAL_REVIEW":
      return "You are restricted from reviewing approval requests.";
    case "STAFF_RULE_MANAGE":
      return "You are restricted from managing staff rules.";
    default:
      return "This action is currently restricted.";
  }
};
