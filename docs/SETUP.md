# ASTRA - Setup

How the infrastructure is put together and which environment variable does what.
Day-to-day developer setup is in [`ONBOARDING.md`](../ONBOARDING.md); releasing and
the runbook are in [`DEPLOY.md`](DEPLOY.md). **Never commit a real `.env`.**

## Services

| Service | Used for | Where configured |
|---|---|---|
| **Vercel** | Hosts `apps/web` (backoffice + API), region `fra1` (`apps/web/vercel.json`), Node 24 | Project `astra-app`, root directory `apps/web` |
| **Neon** | Postgres (pooled URL at runtime, direct URL for migrations), provisioned through the Vercel integration, which injects `STORAGE_*` variables | Vercel > Storage |
| **Aruba SMTP** | Sign-in OTP and staff/admin e-mail. Optional second mailbox (`*_2`) as failover when the first hits Aruba's hourly cap (`apps/web/lib/smtp-failover.ts`) | Vercel env |
| **Resend** | Last-resort fallback transport, only if no SMTP is configured. **Not used in production** (`RESEND_API_KEY` is unset). | Vercel env |
| **Supabase** | Read-only catalogue of guides, handouts and materials; files are public storage URLs | Vercel env |
| **Eventbrite** | Ticket checkout (browser sheet), per-event discount codes, reward code import | Vercel env |
| **Mapbox** | Discounts map in the app (public `pk.` token baked in per build) and geocoding in the backoffice | EAS env + Vercel env |
| **OpenAI + separate Postgres** | Optional "Ask ASTRA" chatbot (`/api/chat`), off in the app | Vercel env (`CHAT_ENABLED`) |
| **Sentry** | Mobile crash and performance reporting. **Web has no server-side error tracking**, use Vercel logs | EAS env |
| **Expo / EAS** | Builds, store submission, optional OTA updates (owner `mfmatozza`, project id in `app.config.ts`) | expo.dev |

Free Vercel Hobby and Expo free plans are in use: logs are kept about a day, and
EAS builds are queue-limited. See "Plans and ownership" in `DEPLOY.md`.

## Dev and preview database (owner action, strongly recommended)

> **WARNING.** Today the Vercel **Preview** and **Development** environments hold
> the **same** Neon connection strings and auth secrets as **Production**
> (`STORAGE_*`, `BETTER_AUTH_SECRET`, `CARD_TOKEN_HMAC_SECRET`,
> `ALLOWED_EMAIL_DOMAINS`, `MOBILE_ALLOWED_ORIGINS`). Anything you run locally with
> a pulled env, any preview deployment and any Prisma command reads and writes
> **live student data**, and the dev-login bypass can create an ADMIN session in
> production data.

Recommended setup, to be done by the project owner in the consoles:

1. **Neon console**: create a branch `dev` (and optionally `preview`) of the
   production project (branches are instant and free). Copy its pooled and direct
   connection strings.
2. **Vercel > Project > Settings > Environment Variables**: edit the Neon-integration
   variables (`STORAGE_DATABASE_URL`, `STORAGE_DATABASE_URL_UNPOOLED`,
   `STORAGE_POSTGRES_*`, `STORAGE_PG*`) so they are scoped to **Production only**, and add
   `DATABASE_URL` / `DIRECT_URL` for **Preview** and **Development** pointing at the
   branches.
3. Give Preview and Development **their own** `BETTER_AUTH_SECRET` and
   `CARD_TOKEN_HMAC_SECRET` (`openssl rand -base64 32`, `openssl rand -hex 32`), so a
   preview can never mint a production-valid session or card token.
4. Re-add secrets as **Sensitive** variables (Vercel cannot show them again): the
   admin trio, the two secrets above, `STORAGE_*` password and URLs, Mapbox token.
5. Disable the unused **Neon Auth** service on the project (Neon console), it holds
   an unused `neon_auth` schema with public sign-up enabled.
6. Only then use `vercel env pull apps/web/.env --environment=development`.

Until that is done, build your own Neon branch URL by hand into `apps/web/.env`.

## Environment variables

**Scope column:** *P* = Production, *V* = Preview, *D* = Development (Vercel). The
"recommended" scoping assumes the dev and preview database from the section above.

### `apps/web` (Vercel / `apps/web/.env`)

| Variable | Required | Scope (recommended) | Purpose |
|---|---|---|---|
| `DATABASE_URL` or `STORAGE_DATABASE_URL` / `POSTGRES_PRISMA_URL` / `POSTGRES_URL` | yes | P (prod DB), V+D (branch) | Pooled runtime connection. The code takes the first one that exists. |
| `DIRECT_URL` or `STORAGE_DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` | yes (migrations) | same | Direct connection for `prisma migrate` |
| `BETTER_AUTH_SECRET` | yes | **separate per environment** | Signs sessions |
| `BETTER_AUTH_URL` | recommended | P: `https://app.astrabocconi.com` | Public base URL of auth. If unset it falls back to `VERCEL_PROJECT_PRODUCTION_URL`. |
| `CARD_TOKEN_HMAC_SECRET` | yes | **separate per environment** | Signs QR card tokens |
| `ALLOWED_EMAIL_DOMAINS` | no (default `studbocconi.it,unibocconi.it`) | all | Domains allowed to request an OTP |
| `MOBILE_ALLOWED_ORIGINS` | no | all | Extra trusted origins (CORS / auth). Native requests carry no `Origin`. |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `EMAIL_FROM` | yes in P | P | Primary mailbox (Aruba: `smtps.aruba.it`, 465, secure) |
| `SMTP_USER_2` `SMTP_PASS_2` `EMAIL_FROM_2` | no | P | Failover mailbox |
| `RESEND_API_KEY` `RESEND_FROM` | no | none | Dead fallback, leave unset |
| `ADMIN_USERNAME` `ADMIN_EMAIL` `ADMIN_PASSWORD_HASH` | yes for backoffice admin | P (and your own for D) | The single environment admin. Hash from `node apps/web/scripts/create-admin.mjs <username> <email> [password]`. |
| `ADMIN_2FA_ENABLED` | no | P | Controls the admin second factor. Factual behaviour: when the variable is set, only the exact string `true` enables the e-mailed code; when it is **unset** the code is on in production and off elsewhere (`apps/web/lib/admin-auth.ts`). Do not change it without the owner. |
| `DEV_LOGIN_ENABLED` | no | **never set in P** | Forces `POST /api/auth/dev-login` on in a production build. It is always on when `NODE_ENV` is not production. Leave unset in Production. |
| `DEMO_REVIEW_EMAIL` `DEMO_REVIEW_OTP` | no | P only | App Review demo account with a fixed code |
| `CRON_SECRET` | yes once the cron routes ship | P | Vercel sends it as `Authorization: Bearer` to `/api/cron/*`; the routes reject anything else. `openssl rand -hex 32`. |
| `SIGNUP_TOMBSTONE_SECRET` | yes once the hardened deletion ships | P | Secret used by the sign-up tombstone for deleted accounts (backend hardening round). Generate with `openssl rand -hex 32`, keep it stable; check `apps/web/lib/account.ts` for the exact use. |
| `CHAT_ENABLED` | no | P | `true` turns `/api/chat` on. The app has no chat screen, so leave it unset/false. |
| `OPENAI_API_KEY` `RAG_DATABASE_URL` `RAG_MIN_SIMILARITY` | only with chat | P | Chatbot upstreams |
| `SUPABASE_URL` `SUPABASE_SECRET_KEY` | yes | P | Materials/guides catalogue |
| `EVENTBRITE_PRIVATE_TOKEN` `EVENTBRITE_ORG_ID` | for Eventbrite features | P | Discount-code generation and reward code import |
| `MAPBOX_TOKEN` (or `EXPO_PUBLIC_MAPBOX_TOKEN`) | for backoffice geocoding | P | Address search in the partner form |
| `FREEATB_FUNCTION_URL` `FREEATB_ANON_KEY` | no | P | Overrides for the Free@B classroom feed (public anon key has an in-code default) |

Set automatically by Vercel: `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`,
`NODE_ENV`. `turbo.json` passes the variables above through to builds; add new
server variables to its `globalPassThroughEnv` list as well.

### `apps/mobile` (EAS environment variables / `apps/mobile/.env.local`)

All `EXPO_PUBLIC_*` values are **public** (inlined in the JS bundle).

| Variable | Where | Purpose |
|---|---|---|
| `APP_ENV` | set by `eas.json` per profile | `development` / `staging` / `production`, selects the API URL in `app.config.ts` |
| `EXPO_PUBLIC_API_URL` | `eas.json` (preview, production) and `.env.local` for dev | API base URL. Production: `https://app.astrabocconi.com` |
| `EXPO_PUBLIC_SENTRY_DSN` | **EAS env var** (preview, production) | Without it Sentry silently stays off |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | **EAS env var** + `.env.local` | Public `pk.` token, without it the map shows an empty state |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | EAS **secret** / shell / `~/.netrc` | Secret `sk.` token (scope `DOWNLOADS:READ`), build machine only |
| `SENTRY_AUTH_TOKEN` (+ `SENTRY_ORG`, `SENTRY_PROJECT`) | EAS **secret** | Enables source-map and debug-file upload. Without the token the Sentry plugin and Metro hook are not loaded (`app.config.ts`, `metro.config.js`). |
| `GOOGLE_SERVICES_JSON` | EAS **file** env var | Android FCM config (`google-services.json`). Without it Android push does not work. |

Check what EAS holds with `eas env:list production` (needs `eas login`).

## Mobile build prerequisites (EAS)

1. Expo account `mfmatozza`, `npm i -g eas-cli`, `eas login`.
2. Profiles are in `apps/mobile/eas.json`: `development` (dev client), `preview`
   (internal), `production` (store, `autoIncrement` build numbers, remote
   versioning). Each has an OTA `channel` of the same name.
3. The root `.easignore` keeps `apps/web`, secrets (`*.p8`, `.env*`, `secrets/`) and
   native folders out of the uploaded archive. `eas submit` reads the App Store
   Connect key from `apps/mobile/secrets/` locally (never uploaded, gitignored).
4. Android targets API 36 through `expo-build-properties`.
5. **Never start an EAS build casually**: the project is on the free Expo plan.

## Sentry

Mobile only. The DSN goes in `EXPO_PUBLIC_SENTRY_DSN`. For readable stack traces
create a Sentry auth token (scope `project:releases`, `org:read`) and store it as the EAS
secret `SENTRY_AUTH_TOKEN`, plus `SENTRY_ORG` and `SENTRY_PROJECT`. The web app
has no server-side tracking: use Vercel's runtime logs (about one day on Hobby) or
add a log drain.
