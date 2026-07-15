import { z } from "zod";

// Zod schemas are the single source of truth for anything crossing the network
// boundary. TS types are inferred from them (`z.infer<...>`), never duplicated.
//
// TODO(scaffold): add the real request/response schemas alongside the DB work.
// Example of the intended pattern (kept as a live reference, not a feature):

/** Payload for POST /api/auth/otp/send — request an email OTP. */
export const sendOtpInput = z.object({
  email: z.string().email(),
});
export type SendOtpInput = z.infer<typeof sendOtpInput>;

/** Shape returned by GET /api/me for the authenticated student. */
export const meResponse = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
});
export type MeResponse = z.infer<typeof meResponse>;
