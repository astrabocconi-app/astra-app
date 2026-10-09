// Turns raw audit rows into sentences. Pure, so it can be tested without a database.

const PAST: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  publish: "published",
  unpublish: "unpublished",
  revoke: "revoked",
  send: "sent",
  upload: "uploaded",
  adjust: "adjusted",
  fulfil: "handed over",
  cancel: "cancelled",
  signin: "signed in",
  login: "signed in",
  reset: "reset",
  remove: "removed",
  generate: "generated",
};

const DESTRUCTIVE = new Set(["delete", "revoke", "cancel", "remove"]);

const TARGET: Record<string, string> = {
  NewsPost: "News post",
  Event: "Event",
  Partner: "Venue",
  PartnerAccount: "Venue login",
  Points: "Points",
  PushCampaign: "Notification",
  Reward: "Reward",
  RewardCode: "Voucher codes",
  RewardRedemption: "Redemption",
  SupportMessage: "Support message",
  User: "Account",
  Upload: "Image upload",
  Session: "Sign-in",
};

/** "NewsPost" → "News post" for types without a hand-written label. */
function spaced(s: string) {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ");
}

export function describeTarget(type: string): string {
  return TARGET[type] ?? spaced(type);
}

/**
 * "create" → created; "staff.revoke" → "revoked staff"; unknown strings are
 * shown readable rather than raw ("codes.delete" → "deleted codes").
 */
export function describeAction(action: string): { label: string; destructive: boolean } {
  const parts = action.split(".");
  const verb = parts[parts.length - 1] ?? action;
  const noun = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const past = PAST[verb] ?? spaced(verb);
  return {
    label: noun ? `${past} ${spaced(noun)}` : past,
    destructive: DESTRUCTIVE.has(verb),
  };
}

/** The human-readable name most writers record in the metadata. */
export function summarise(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  for (const key of ["title", "name", "username", "reason"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const rome = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  // Timestamps are shown in Milan time, like every other date in the backoffice.
  if (ISO.test(s) && !Number.isNaN(Date.parse(s))) return rome.format(new Date(s));
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

/**
 * Field diffs the API records as `{ field: [old, new] }`, either at the top of the
 * metadata or under `changes`. Anything else in the metadata is ignored.
 */
export function fieldChanges(metadata: unknown): { field: string; from: string; to: string }[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const root = metadata as Record<string, unknown>;
  const src =
    root.changes && typeof root.changes === "object" && !Array.isArray(root.changes)
      ? (root.changes as Record<string, unknown>)
      : root;
  const out: { field: string; from: string; to: string }[] = [];
  for (const [field, v] of Object.entries(src)) {
    if (Array.isArray(v) && v.length === 2) {
      out.push({ field: spaced(field).toLowerCase(), from: show(v[0]), to: show(v[1]) });
    }
  }
  return out;
}
