# ASTRA — Setup

Step-by-step for the external accounts and secrets. **Never commit a real `.env`.**
Copy the `*.env.example` files and fill them in:

```bash
cp apps/web/.env.example    apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

---

## 1. Neon (Postgres) — three databases: dev / staging / prod

We use **three separate Neon projects (or three databases)**: `dev`, `staging`,
`prod`. Do **not** share one across environments.

For **each** environment:

1. Create a project at <https://console.neon.tech> (region close to your Vercel
   region, e.g. `eu-central-1`).
2. **Enable connection pooling** (Neon → project → *Settings* → *Connection
   pooling*; PgBouncer is on by default). You will use two connection strings:
   - **Pooled** — host contains **`-pooler`**. → `DATABASE_URL`. Used by the app at
     runtime on Vercel. Serverless functions open many short-lived connections;
     plain unpooled connections **exhaust** the server. Always pooled at runtime.
   - **Direct / unpooled** — host **without** `-pooler`. → `DIRECT_URL`. Used **only**
     by `prisma migrate` and introspection (migrations need a real session).
3. Copy both strings from Neon → *Connection Details* (toggle "Pooled connection").
4. Put them in the matching environment's env (local `.env`, or Vercel env vars for
   staging/prod — see [DEPLOY.md](DEPLOY.md)).

> Prisma is already configured for this split in
> `packages/db/prisma/schema.prisma` (`url = DATABASE_URL`, `directUrl = DIRECT_URL`).

### Per-PR preview databases (Neon branches)
For preview deployments, create a **Neon branch** per PR (a copy-on-write branch of
`dev`) and point that deploy's `DATABASE_URL`/`DIRECT_URL` at the branch. The
[Neon–Vercel integration](https://neon.tech/docs/guides/vercel) can automate
branch-per-preview; wire it up in the Vercel project settings.

### Run migrations
The schema is already migrated on the shared dev DB, so you don't need this to
start. Use it when you change the Prisma schema (uses `DIRECT_URL`):
```bash
npm run db:migrate      # prisma migrate dev
npm run db:seed         # minimal fake data
npm run db:studio       # browse
```

## 2. Resend (email / OTP delivery)

1. Create an account at <https://resend.com>, verify your sending domain.
2. Create an API key: *API Keys* → *Create*. → `RESEND_API_KEY`.
3. Better Auth uses this to send the OTP emails (custom SMTP/transactional).

## 3. Cloudflare R2 (file storage)

1. Cloudflare dashboard → **R2** → create a bucket (e.g. `astra-materials`).
   → `R2_BUCKET`.
2. R2 overview page shows the **Account ID** → `R2_ACCOUNT_ID`.
3. *Manage R2 API Tokens* → create a token scoped to the bucket →
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
4. Access is via the S3-compatible SDK with **short-lived signed URLs** (never make
   the bucket public).

## 4. Vercel (hosts apps/web = dashboard + API)

See [DEPLOY.md](DEPLOY.md). In short: import the repo, set the **Root Directory** to
`apps/web`, add all `apps/web/.env` variables per environment, deploy.

## 5. Expo / EAS (mobile)

1. Create an Expo account at <https://expo.dev>; `npm i -g eas-cli`; `eas login`.
2. In `apps/mobile`, run `eas init` and paste the returned **projectId** into
   `app.config.ts` (`extra.eas.projectId`).
3. Build profiles live in `apps/mobile/eas.json` (`development` / `preview` /
   `production`). Android targets **API 36** via `expo-build-properties` (required on
   Play as of 2026-08-31) — verify your Expo SDK supports it before a store build.
4. `EXPO_PUBLIC_API_URL` points at the right `apps/web` deployment per environment;
   staging/prod URLs are baked per profile in `app.config.ts`.

## 6. Sentry (errors)

1. Create projects for **web** and **mobile** at <https://sentry.io>.
2. Copy each DSN: *Settings → Client Keys (DSN)*. → `SENTRY_DSN` (web),
   `EXPO_PUBLIC_SENTRY_DSN` (mobile). A DSN is public; disabled in dev by config.

---

## Environment variables reference

### `apps/web/.env`
| Var | What / where |
|---|---|
| `DATABASE_URL` | Neon **pooled** (`-pooler`) — runtime |
| `DIRECT_URL` | Neon **direct** — migrations only |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public URL of this web app |
| `RESEND_API_KEY` | Resend → API Keys |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Cloudflare R2 |
| `CARD_TOKEN_HMAC_SECRET` | `openssl rand -hex 32` — signs scannable card tokens |
| `SENTRY_DSN` | Sentry (web) |
| `ALLOWED_EMAIL_DOMAINS` | comma-separated, e.g. `studbocconi.it,unibocconi.it` — validated before OTP send |
| `MOBILE_ALLOWED_ORIGINS` | CORS allow-list for `/api/*` |

### `apps/mobile/.env`
| Var | What / where |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of `apps/web` (dev override) — **public** |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry (mobile) — **public** |
| `APP_ENV` | `development` / `staging` / `production` |

> **`EXPO_PUBLIC_*` is inlined into the shipped bundle.** Never put a secret there.
