// Better Auth server instance — email-OTP only, Bearer tokens for mobile.
//
// SERVER-ONLY. Never import from client components. See docs/ARCHITECTURE.md §Auth.
//
//   - Only Bocconi emails (studbocconi.it / unibocconi.it) may request an OTP.
//   - OTP delivery: SMTP (e.g. Aruba) if SMTP_* is configured, else Resend if
//     configured, otherwise logged to the server console in development so the
//     flow is testable without any email provider.
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
import nodemailer, { type Transporter } from "nodemailer";
import { ASTRA_LOGO_PNG_BASE64 } from "./email-logo";
import { OTP_LOGO_CID, OTP_SUBJECT, otpEmailHtml, otpEmailText } from "./email-template";

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

// SMTP transport (e.g. Aruba). Enabled when SMTP_HOST + SMTP_USER + SMTP_PASS
// are set. Aruba mailboxes: host `smtps.aruba.it`, port 465 (SMTP_SECURE=true).
// Built lazily and reused across warm invocations.
const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpEnabled = Boolean(
  smtpHost &&
    smtpUser &&
    smtpPass &&
    ![smtpHost, smtpUser, smtpPass].some((v) => v!.includes("PLACEHOLDER")),
);
let smtpTransport: Transporter | null = null;
function getSmtp(): Transporter | null {
  if (!smtpEnabled) return null;
  if (!smtpTransport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    smtpTransport = nodemailer.createTransport({
      host: smtpHost,
      port,
      // true for 465 (implicit TLS); false for 587 (STARTTLS). Overridable.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  return smtpTransport;
}

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

// Sender for OTP emails. For SMTP this must be an address on the authenticated
// mailbox's domain (e.g. `ASTRA <noreply@yourdomain.it>`); for Resend it must be
// on a VERIFIED domain (`onboarding@resend.dev` only reaches your own account).
// EMAIL_FROM is preferred; RESEND_FROM is kept for backward compatibility.
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? "ASTRA <onboarding@resend.dev>";

// Inline logo attachment (CID) — auto-displays without a "load images" prompt.
const logoAttachment = {
  filename: "astra-logo.png",
  content: Buffer.from(ASTRA_LOGO_PNG_BASE64, "base64"),
  cid: OTP_LOGO_CID,
  contentType: "image/png",
};

async function deliverOtp(email: string, otp: string): Promise<void> {
  // 1) SMTP (e.g. Aruba) takes priority when configured.
  const smtp = getSmtp();
  if (smtp) {
    await smtp.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: OTP_SUBJECT,
      text: otpEmailText(otp),
      html: otpEmailHtml(otp),
      attachments: [logoAttachment],
    });
    return;
  }
  // 2) Resend, if configured. (Inline CID logo isn't sent here; text/HTML still
  //    render — Resend is only a fallback when SMTP isn't set.)
  if (resend) {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: OTP_SUBJECT,
      text: otpEmailText(otp),
      html: otpEmailHtml(otp),
    });
    return;
  }
  // 3) Dev fallback: no provider configured — print the code so we can test.
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
