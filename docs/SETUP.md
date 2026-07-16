# ASTRA — Setup

**Infrastructure is managed by Vercel.** You provision the DB, email, and storage
from the Vercel dashboard; env vars are injected there and pulled locally with one
command — no hand-copying secrets. **Never commit a real `.env`.**

```bash
npm i -g vercel          # once
vercel login
vercel link              # from repo root → pick the astra-app project (Root Dir: apps/web)
vercel env pull apps/web/.env   # writes all env vars locally
cp apps/mobile/.env.example apps/mobile/.env   # mobile has no secrets; edit as needed
```

Re-run `vercel env pull apps/web/.env` whenever the Vercel env changes.

---

## 1. Database — Neon (via Vercel Storage)

Provision it **through Vercel** so the connection strings are injected automatically:

1. Vercel project → **Storage** → **Create** → **Neon** (Postgres). Pick a region
   close to your functions (e.g. `eu-central-1`) and connect it to the project.
2. Vercel injects the connection env vars (`DATABASE_URL`, `POSTGRES_PRISMA_URL`,
   `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`, …) into all environments.
   Our DB layer reads whichever exists — **pooled** for the runtime client,
   **unpooled/direct** for `prisma migrate` (see `packages/db/prisma.config.ts`).
3. Pull them locally: `vercel env pull apps/web/.env`.
4. Apply the schema to that DB: `npm run db:migrate` then `npm run db:seed`.

> Serverless functions must use the **pooled** connection (PgBouncer) at runtime;
> `prisma migrate` uses the **direct/unpooled** one. Both are handled automatically
> from the injected vars.

### Preview databases (per-PR branches)
The Neon–Vercel integration can create a **branch DB per preview deployment**
automatically — enable it in the integration settings once you deploy.

### Run migrations
The schema is already migrated on the shared dev DB, so you don't need this to
start. Use it when you change the Prisma schema (uses `DIRECT_URL`):
```bash
npm run db:migrate      # prisma migrate dev
npm run db:seed         # minimal fake data
npm run db:studio       # browse
```

## 2. Email — Resend (OTP delivery)

Install the **Resend** integration from the **Vercel Marketplace** (Project →
Integrations) — it provisions Resend and injects `RESEND_API_KEY`. Verify a sending
domain in Resend for real delivery. In **local dev** you don't need it: the OTP
code is printed to the server console when `RESEND_API_KEY` is unset.

## 3. File storage — Vercel Blob

Vercel project → **Storage** → **Blob** → create a store and connect it. Vercel
injects `BLOB_READ_WRITE_TOKEN`. Only needed once the Materials/News-image features
land (Phase 9–10); no action required before then.

## 4. Vercel (hosts everything: app + API + DB + Blob + email)

See [DEPLOY.md](DEPLOY.md). Import the repo, set **Root Directory** = `apps/web`,
connect the **Neon**, **Blob**, and **Resend** integrations (they inject their env
vars), set the few manual secrets, and deploy. Pull env locally with
`vercel env pull apps/web/.env`.

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
| DB connection (pooled + direct) | **injected by Vercel's Neon integration** (`DATABASE_URL`, `POSTGRES_PRISMA_URL`, `*_UNPOOLED`/`POSTGRES_URL_NON_POOLING`) |
| `BETTER_AUTH_SECRET` | manual — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | manual — public URL of this web app / deployment |
| `RESEND_API_KEY` | injected by the Resend Marketplace integration |
| `BLOB_READ_WRITE_TOKEN` | injected by the Vercel Blob store |
| `CARD_TOKEN_HMAC_SECRET` | manual — `openssl rand -hex 32` (signs scannable card tokens) |
| `SENTRY_DSN` | manual — Sentry (web) |
| `ALLOWED_EMAIL_DOMAINS` | comma-separated, e.g. `studbocconi.it,unibocconi.it` — validated before OTP send |
| `MOBILE_ALLOWED_ORIGINS` | CORS allow-list for `/api/*` |

### `apps/mobile/.env`
| Var | What / where |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of `apps/web` (dev override) — **public** |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry (mobile) — **public** |
| `APP_ENV` | `development` / `staging` / `production` |

> **`EXPO_PUBLIC_*` is inlined into the shipped bundle.** Never put a secret there.
