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
