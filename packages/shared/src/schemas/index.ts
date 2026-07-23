import { z } from "zod";

// Zod schemas are the single source of truth for anything crossing the network
// boundary. TS types are inferred from them (`z.infer<...>`), never duplicated.

/** Payload for POST /api/auth/email-otp/send-verification-otp. */
export const sendOtpInput = z.object({
  email: z.string().email(),
});
export type SendOtpInput = z.infer<typeof sendOtpInput>;

/** Payload for POST /api/auth/sign-in/email-otp. */
export const verifyOtpInput = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpInput>;

/** Shape returned by GET /api/me for the authenticated student. */
export const meResponse = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  roles: z.array(z.string()),
});
export type MeResponse = z.infer<typeof meResponse>;

// ── Points ──────────────────────────────────────────────────────────────────

/** GET /api/points/balance — the current user's spendable balance. */
export const pointsBalanceResponse = z.object({
  balance: z.number().int(),
  kind: z.string(),
});
export type PointsBalanceResponse = z.infer<typeof pointsBalanceResponse>;

/** A single append-only ledger entry (read model). */
export const ledgerEntry = z.object({
  id: z.string(),
  delta: z.number().int(), // + earned, − spent
  source: z.string(),
  reason: z.string(),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  createdAt: z.string(), // ISO
});
export type LedgerEntry = z.infer<typeof ledgerEntry>;

/** GET /api/points/history — recent ledger entries, newest first. */
export const pointsHistoryResponse = z.object({
  entries: z.array(ledgerEntry),
});
export type PointsHistoryResponse = z.infer<typeof pointsHistoryResponse>;

// ── CMS: News ─────────────────────────────────────────────────────────────
// `imageUrl` is either a pasted absolute URL or a /api/media/:id path for an
// image uploaded to our own store. Empty string → null on the wire.

const optionalUrl = z
  .string()
  .trim()
  .url()
  .nullish()
  .or(z.literal("").transform(() => null));

// Image reference: an absolute http(s) URL OR a relative /api/media/:id path
// (uploads to our own store). Empty → null.
const optionalImageRef = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || v.startsWith("/api/media/") || /^https?:\/\/\S+$/.test(v),
    { message: "Enter a valid image URL" },
  );

/** Admin create/update payload for a news post. */
export const newsInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: z.string().trim().min(1, "Body is required"),
  excerpt: z.string().trim().max(240).nullish(),
  imageUrl: optionalImageRef,
  published: z.boolean().default(false),
  pinned: z.boolean().default(false),
});
export type NewsInput = z.infer<typeof newsInput>;

export const newsItem = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  excerpt: z.string().nullable(),
  imageUrl: z.string().nullable(),
  published: z.boolean(),
  pinned: z.boolean(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NewsItem = z.infer<typeof newsItem>;

export const newsListResponse = z.object({ items: z.array(newsItem) });
export type NewsListResponse = z.infer<typeof newsListResponse>;

// ── CMS: Events (advertise-only) ────────────────────────────────────────────

/** Admin create/update payload for an event. */
export const eventInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().nullish(),
  imageUrl: optionalImageRef,
  location: z.string().trim().nullish(),
  startsAt: z.string().min(1, "Start date is required"), // ISO; parsed server-side
  endsAt: z.string().nullish(),
  externalTicketUrl: optionalUrl,
  published: z.boolean().default(false),
});
export type EventInput = z.infer<typeof eventInput>;

export const eventItem = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  externalTicketUrl: z.string().nullable(),
  published: z.boolean(),
  createdAt: z.string(),
});
export type EventItem = z.infer<typeof eventItem>;

export const eventListResponse = z.object({ items: z.array(eventItem) });
export type EventListResponse = z.infer<typeof eventListResponse>;

// ── CMS: Rewards ──────────────────────────────────────────────────────────

/** Admin create/update payload for a reward. */
export const rewardInput = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().nullish(),
  imageUrl: optionalImageRef,
  costPoints: z.coerce.number().int().min(0, "Cost must be ≥ 0"),
  stock: z.coerce.number().int().min(0).nullish(), // null = unlimited
  active: z.boolean().default(true),
});
export type RewardInput = z.infer<typeof rewardInput>;

export const rewardItem = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  costPoints: z.number().int(),
  stock: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
});
export type RewardItem = z.infer<typeof rewardItem>;

export const rewardListResponse = z.object({ items: z.array(rewardItem) });
export type RewardListResponse = z.infer<typeof rewardListResponse>;
