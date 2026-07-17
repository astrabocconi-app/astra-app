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
