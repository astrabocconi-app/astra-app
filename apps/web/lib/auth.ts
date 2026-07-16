// Better Auth server instance — email-OTP only, Bearer tokens for mobile.
//
// SERVER-ONLY. Never import from client components. See docs/ARCHITECTURE.md §Auth.
//
//   - Only Bocconi emails (studbocconi.it / unibocconi.it) may request an OTP.
//   - OTP delivery: Resend if configured, otherwise logged to the server
//     console in development so the flow is testable without a Resend account.
//   - The `bearer` plugin lets the mobile app authenticate with
//     `Authorization: Bearer <token>` (matches @astra/shared's typed client),
//     instead of cookies.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP, bearer } from "better-auth/plugins";
import { prisma } from "@astra/db";
import { ALLOWED_EMAIL_DOMAINS } from "@astra/shared";
import { Resend } from "resend";

// Allowed sign-in domains. Configurable via ALLOWED_EMAIL_DOMAINS (comma-list);
// defaults to the shared constant (studbocconi.it, unibocconi.it).
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? ALLOWED_EMAIL_DOMAINS.join(","))
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function emailDomainAllowed(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}

const DOMAIN_ERROR = `Only ${ALLOWED_DOMAINS.map((d) => "@" + d).join(" or ")} email addresses are allowed.`;

const resendKey = process.env.RESEND_API_KEY;
const resend =
  resendKey && !resendKey.includes("PLACEHOLDER") ? new Resend(resendKey) : null;

const trustedOrigins = [
  process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ...(process.env.MOBILE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

async function deliverOtp(email: string, otp: string): Promise<void> {
  if (resend) {
    await resend.emails.send({
      from: "ASTRA <onboarding@resend.dev>", // TODO: switch to a verified domain sender
      to: email,
      subject: "Your ASTRA sign-in code",
      text: `Your ASTRA sign-in code is ${otp}. It expires in 10 minutes.`,
    });
    return;
  }
  // Dev fallback: no Resend key configured — print the code so we can test.
  // eslint-disable-next-line no-console
  console.log(`\n[auth] DEV OTP for ${email}: ${otp}\n`);
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins,
  // We authenticate exclusively via email OTP; no passwords.
  emailAndPassword: { enabled: false },
  // Hard gate: reject any OTP send/verify for non-@studbocconi.it emails at the
  // API boundary — before user-existence logic — so it can't be bypassed via
  // Better Auth's anti-enumeration "silent success" for unknown emails.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const guarded = [
        "/email-otp/send-verification-otp",
        "/sign-in/email-otp",
      ];
      if (guarded.includes(ctx.path)) {
        const email = (ctx.body as { email?: string } | undefined)?.email ?? "";
        if (!emailDomainAllowed(email)) {
          throw new APIError("BAD_REQUEST", { message: DOMAIN_ERROR });
        }
      }
    }),
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      async sendVerificationOTP({ email, otp }) {
        if (!emailDomainAllowed(email)) {
          throw new APIError("BAD_REQUEST", { message: DOMAIN_ERROR });
        }
        await deliverOtp(email, otp);
      },
    }),
    bearer(),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      // Max 3 OTP send requests per minute per client (per docs/ARCHITECTURE.md).
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
    },
  },
});

export type Auth = typeof auth;
