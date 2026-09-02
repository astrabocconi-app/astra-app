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
import { prisma, Role, LedgerSource } from "@astra/db";
import { earn } from "./points";
import { ALLOWED_EMAIL_DOMAINS } from "@astra/shared";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { ASTRA_LOGO_PNG_BASE64 } from "./email-logo";
import { OTP_LOGO_CID, OTP_SUBJECT, otpEmailHtml, otpEmailText } from "./email-template";
import { verifyPassword } from "./partner";
import { sendWithFailover, type Mailbox } from "./smtp-failover";
import {
  verifyAdminCredentials,
  admin2faEnabled,
  adminEmail,
  maskEmail,
  generateOtp,
  storeAdminOtp,
  consumeAdminOtp,
  upsertAdminUser,
} from "./admin-auth";
import { verifyStaffCredentials } from "./staff-accounts";

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

// SMTP transports (Aruba). Enabled when SMTP_HOST + SMTP_USER + SMTP_PASS are
// set. Aruba mailboxes: host `smtps.aruba.it`, port 465 (SMTP_SECURE=true).
// Built lazily and reused across warm invocations.
//
// A SECOND mailbox can be configured with SMTP_USER_2 / SMTP_PASS_2. Aruba caps
// how much one mailbox may send per hour, and sign-in email is the one thing
// that must not fail: a student who can't get a code can't use the app at all.
// Launch day is several hundred logins in an hour from a mailbox that normally
// sends a handful, which is exactly when such a cap bites. The second mailbox
// shares the host and port; only the credentials and the From address differ.
const smtpHost = process.env.SMTP_HOST;

function smtpUsable(...values: (string | undefined)[]): boolean {
  return values.every((v) => Boolean(v) && !v!.includes("PLACEHOLDER"));
}

interface SmtpAccount extends Mailbox {
  user: string;
  pass: string;
  /** Overrides the derived From address when set. */
  fromOverride?: string;
  transport: Transporter | null;
}

const smtpAccounts: SmtpAccount[] = [];
if (smtpUsable(smtpHost, process.env.SMTP_USER, process.env.SMTP_PASS)) {
  smtpAccounts.push({
    label: "primary",
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    fromOverride: process.env.EMAIL_FROM,
    blockedUntil: 0,
    transport: null,
  });
}
if (smtpUsable(smtpHost, process.env.SMTP_USER_2, process.env.SMTP_PASS_2)) {
  smtpAccounts.push({
    label: "fallback",
    user: process.env.SMTP_USER_2!,
    pass: process.env.SMTP_PASS_2!,
    fromOverride: process.env.EMAIL_FROM_2,
    blockedUntil: 0,
    transport: null,
  });
}

function transportFor(account: SmtpAccount): Transporter {
  if (!account.transport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    account.transport = nodemailer.createTransport({
      host: smtpHost,
      port,
      // true for 465 (implicit TLS); false for 587 (STARTTLS). Overridable.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: { user: account.user, pass: account.pass },
    });
  }
  return account.transport;
}

/**
 * How long to stop reaching for a mailbox that just refused us.
 *
 * Aruba's cap is hourly, but this is only a latency optimisation: without it
 * every send during a spike pays a failed connect-authenticate-reject against
 * the exhausted mailbox before reaching the fallback. Deliberately shorter than
 * an hour so a mailbox blocked for some transient reason comes back quickly.
 */
const SMTP_COOLDOWN_MS = 10 * 60 * 1000;

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
  // `next dev` falls back to 3001+ when 3000 is already taken locally.
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3001"] : []),
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

/**
 * The single App Review demo account, and the fixed code it signs in with.
 *
 * Both must be set for the bypass to exist at all — an unset env var leaves the
 * normal random-OTP path completely untouched. The address still has to pass
 * the Bocconi domain gate like any other, so this widens nothing beyond one
 * specific mailbox-less account that holds no real student's data.
 */
const DEMO_REVIEW_EMAIL = (process.env.DEMO_REVIEW_EMAIL ?? "").trim().toLowerCase();
const DEMO_REVIEW_OTP = (process.env.DEMO_REVIEW_OTP ?? "").trim();

function isDemoReviewEmail(email: string): boolean {
  return (
    DEMO_REVIEW_EMAIL.length > 0 &&
    DEMO_REVIEW_OTP.length > 0 &&
    email.trim().toLowerCase() === DEMO_REVIEW_EMAIL
  );
}

/**
 * Aruba requires the From address to match the authenticated mailbox, so the
 * fallback cannot reuse EMAIL_FROM. Keep the display name, swap the address.
 */
function fromFor(account: SmtpAccount): string {
  if (account.fromOverride && !account.fromOverride.includes("PLACEHOLDER")) {
    return account.fromOverride;
  }
  const displayName = EMAIL_FROM.match(/^\s*(.*?)\s*</)?.[1];
  return displayName ? `${displayName} <${account.user}>` : account.user;
}

/** One attempt through a specific mailbox. Throws on refusal. */
async function sendThrough(account: SmtpAccount, email: string, otp: string): Promise<void> {
  await transportFor(account).sendMail({
    from: fromFor(account),
    to: email,
    subject: OTP_SUBJECT,
    text: otpEmailText(otp),
    html: otpEmailHtml(otp),
    attachments: [logoAttachment],
  });
}

async function deliverOtp(email: string, otp: string): Promise<void> {
  // 1) SMTP (Aruba) takes priority when configured. Mailboxes are tried in
  //    turn, so an hourly cap on the primary doesn't stop anyone signing in.
  if (smtpAccounts.length > 0) {
    try {
      await sendWithFailover(smtpAccounts, (account) => sendThrough(account, email, otp), {
        cooldownMs: SMTP_COOLDOWN_MS,
        onWarn: (m) => console.warn(`[auth] ${m}`),
      });
      return;
    } catch (e) {
      // Every mailbox refused. Resend, if configured, is the last resort;
      // otherwise surface it rather than pretending a code was sent.
      if (!resend) {
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Couldn't send the sign-in code. Please try again in a moment.",
          cause: e instanceof Error ? e.message : String(e),
        });
      }
      console.warn("[auth] every SMTP mailbox refused; falling back to Resend");
    }
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
  // 3) No provider configured.
  //
  // In development that's fine — print the code so the flow is testable without
  // an inbox. In production it is NOT: silently "succeeding" here made the app
  // report that a code had been sent when nothing left the server, and the only
  // symptom was students never receiving an email. Fail loudly instead, so a
  // misconfigured deployment is obvious immediately rather than looking healthy.
  if (process.env.NODE_ENV === "production") {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Email isn't configured on the server, so no code could be sent.",
    });
  }
  console.log(`\n[auth] DEV OTP for ${email}: ${otp}\n`);
}

// Partner venues sign in with a login code + password (issued by ASTRA). This
// bypasses the student email-OTP + Bocconi-domain gate entirely and returns a
// bearer token, just like the students' flow, but for a PARTNER_MANAGER account.
function partnerLoginPlugin(): BetterAuthPlugin {
  return {
    id: "partner-login",
    endpoints: {
      partnerLogin: createAuthEndpoint("/partner-login", { method: "POST" }, async (ctx) => {
        const body = ctx.body as { code?: string; password?: string } | undefined;
        const code = String(body?.code ?? "").trim().toLowerCase();
        const password = String(body?.password ?? "");
        if (!code || !password) {
          throw new APIError("BAD_REQUEST", { message: "Code and password are required." });
        }
        const membership = await prisma.partnerMembership.findUnique({
          where: { loginCode: code },
          include: { user: true, partner: true },
        });
        if (!membership || !verifyPassword(password, membership.passwordHash)) {
          throw new APIError("UNAUTHORIZED", { message: "Invalid code or password." });
        }
        const user = membership.user;
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) {
          throw new APIError("INTERNAL_SERVER_ERROR", { message: "Session creation failed." });
        }
        await setSessionCookie(ctx, {
          session,
          user: { ...user, name: user.name ?? membership.partner.name },
        });
        return ctx.json({
          token: session.token,
          user: { id: user.id, email: user.email, name: user.name, roles: user.roles },
          partner: { id: membership.partner.id, name: membership.partner.name },
          // Lets the app send scan-only staff straight to the scanner. The
          // server enforces it too — see /api/partner/stats.
          scanOnly: membership.scanOnly,
        });
      }),
    },
  };
}

// ASTRA's single central admin: username + password (env) → emailed OTP → session.
// Two custom endpoints, mounted under /api/auth/admin-login and /admin-verify.
function adminLoginPlugin(): BetterAuthPlugin {
  return {
    id: "admin-login",
    endpoints: {
      adminLogin: createAuthEndpoint("/admin-login", { method: "POST" }, async (ctx) => {
        const body = ctx.body as { username?: string; password?: string } | undefined;
        const username = String(body?.username ?? "");
        const password = String(body?.password ?? "");

        // Two kinds of account use this one form. The central admin is checked
        // first, from env; anything else is looked up as a staff account.
        if (!verifyAdminCredentials(username, password)) {
          const staff = await verifyStaffCredentials(username, password);
          // Same generic error whichever half is wrong (no enumeration).
          if (!staff) {
            throw new APIError("UNAUTHORIZED", { message: "Invalid username or password." });
          }
          // No OTP step: staff accounts are handed out by the admin and have no
          // mailbox of their own to send a code to. Their reach is limited to
          // the pages ticked for them, and never includes Team or the audit log.
          const session = await ctx.context.internalAdapter.createSession(staff.id);
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Session creation failed." });
          }
          await setSessionCookie(ctx, { session, user: staff });
          return ctx.json({
            ok: true,
            user: { id: staff.id, email: staff.email, name: staff.name, roles: staff.roles },
          });
        }
        // Dev / 2FA-disabled: password alone signs in (no OTP step).
        if (!admin2faEnabled()) {
          const user = await upsertAdminUser();
          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Session creation failed." });
          }
          await setSessionCookie(ctx, { session, user: { ...user, name: user.name ?? "ASTRA Admin" } });
          return ctx.json({
            ok: true,
            user: { id: user.id, email: user.email, name: user.name, roles: user.roles },
          });
        }
        const otp = generateOtp();
        await storeAdminOtp(otp);
        // Dev affordance: print the admin OTP to the server console (never in
        // production), matching deliverOtp's dev fallback for students.
        if (process.env.NODE_ENV !== "production") {
          console.log(`\n[auth] DEV admin OTP: ${otp}\n`);
        }
        await deliverOtp(adminEmail(), otp);
        return ctx.json({ pending: true, sentTo: maskEmail(adminEmail()) });
      }),
      adminVerify: createAuthEndpoint("/admin-verify", { method: "POST" }, async (ctx) => {
        const body = ctx.body as { otp?: string } | undefined;
        const otp = String(body?.otp ?? "").trim();
        if (!otp || !(await consumeAdminOtp(otp))) {
          throw new APIError("UNAUTHORIZED", { message: "Invalid or expired code." });
        }
        const user = await upsertAdminUser();
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) {
          throw new APIError("INTERNAL_SERVER_ERROR", { message: "Session creation failed." });
        }
        await setSessionCookie(ctx, { session, user: { ...user, name: user.name ?? "ASTRA Admin" } });
        return ctx.json({
          ok: true,
          user: { id: user.id, email: user.email, name: user.name, roles: user.roles },
        });
      }),
    },
  };
}

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins,
  // Welcome bonus: +50 points the first time a real student account is
  // created via email-OTP sign-in. Only fires for Better Auth's own
  // adapter-driven user creation — dev-login, partner, and admin accounts are
  // all provisioned through separate direct-Prisma paths and never hit this.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await earn(user.id, 50, {
            source: LedgerSource.SIGNUP,
            reason: "Welcome bonus for joining ASTRA",
          });
        },
      },
    },
  },
  // We authenticate exclusively via email OTP; no passwords.
  emailAndPassword: { enabled: false },
  // Long-lasting login: once a user signs in (OTP for students, code+password
  // for partners), keep them signed in for a year, rolling the expiry forward
  // each day they use the app. The mobile app already persists the bearer token
  // in the OS keychain (apps/mobile/lib/session.ts) and restores it on boot, so
  // this makes "sign in once" effectively permanent unless the app is untouched
  // for a full year. The web dashboard cookie inherits the same lifetime.
  session: {
    expiresIn: 60 * 60 * 24 * 365, // 365 days
    updateAge: 60 * 60 * 24, // roll the expiry forward at most once per day of activity
  },
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
      // App Review can't receive a code: sign-in is gated to Bocconi addresses
      // and reviewers have no such inbox, which would make the app impossible
      // to evaluate and get it rejected. One allowlisted address gets a fixed
      // code instead, handed to Apple in App Store Connect. Everyone else falls
      // through to the random generator (`undefined` -> default).
      generateOTP: ({ email }) => (isDemoReviewEmail(email) ? DEMO_REVIEW_OTP : undefined),
      async sendVerificationOTP({ email, otp }) {
        if (!emailDomainAllowed(email)) {
          throw new APIError("BAD_REQUEST", { message: DOMAIN_ERROR });
        }
        // No inbox exists for the review account, and deliverOtp throws in
        // production when it can't send — so skip delivery for it only.
        if (isDemoReviewEmail(email)) return;
        await deliverOtp(email, otp);
      },
    }),
    bearer(),
    devLoginPlugin(),
    partnerLoginPlugin(),
    adminLoginPlugin(),
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
