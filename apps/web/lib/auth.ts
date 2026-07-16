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

import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { emailOTP, bearer } from "better-auth/plugins";
import { prisma, Role } from "@astra/db";
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

// ── DEV-ONLY login bypass ────────────────────────────────────────────────────
// Lets the two developers sign in by typing a username (no OTP). Enabled ONLY on
// non-production API instances — on any Vercel deploy NODE_ENV === "production",
// so this path returns 404 there. Force-enable elsewhere with DEV_LOGIN_ENABLED
// (do NOT do this on a public server without adding a password).
const DEV_LOGIN =
  process.env.NODE_ENV !== "production" || process.env.DEV_LOGIN_ENABLED === "true";

const DEV_USERS: Record<string, { email: string; name: string }> = {
  blabmerda: { email: "blabmerda@astra.dev", name: "Dev" },
};

/** Custom Better Auth plugin: POST /dev-login { username } → session (dev only). */
function devLoginPlugin(): BetterAuthPlugin {
  return {
    id: "dev-login",
    endpoints: {
      devLogin: createAuthEndpoint("/dev-login", { method: "POST" }, async (ctx) => {
        if (!DEV_LOGIN) {
          throw new APIError("NOT_FOUND", { message: "Not found." });
        }
        const username = String((ctx.body as { username?: string })?.username ?? "")
          .trim()
          .toLowerCase();
        const dev = DEV_USERS[username];
        if (!dev) {
          throw new APIError("BAD_REQUEST", { message: "Unknown dev account." });
        }
        const user = await prisma.user.upsert({
          where: { email: dev.email },
          update: { name: dev.name, roles: [Role.ADMIN], emailVerified: true },
          create: { email: dev.email, name: dev.name, roles: [Role.ADMIN], emailVerified: true },
        });
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) {
          throw new APIError("INTERNAL_SERVER_ERROR", { message: "Session creation failed." });
        }
        await setSessionCookie(ctx, { session, user: { ...user, name: user.name ?? dev.name } });
        return ctx.json({
          token: session.token,
          user: { id: user.id, email: user.email, name: user.name, roles: user.roles },
        });
      }),
    },
  };
}

const DOMAIN_ERROR = `Only ${ALLOWED_DOMAINS.map((d) => "@" + d).join(" or ")} email addresses are allowed.`;

const resendKey = process.env.RESEND_API_KEY;
const resend =
  resendKey && !resendKey.includes("PLACEHOLDER") ? new Resend(resendKey) : null;

// Base URL: explicit override, else the Vercel deployment domain, else local.
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;
const baseURL =
  process.env.BETTER_AUTH_URL ?? vercelProdUrl ?? vercelUrl ?? "http://localhost:3000";

const trustedOrigins = [
  baseURL,
  vercelUrl,
  vercelProdUrl,
  ...(process.env.MOBILE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
].filter((o): o is string => Boolean(o));

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
  baseURL,
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
    devLoginPlugin(),
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
