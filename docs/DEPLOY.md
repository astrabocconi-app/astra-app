# ASTRA — Deploy

## `apps/web` (dashboard + API) → Vercel

The web app is a standard Next.js App Router project inside a Turborepo monorepo.
No `vercel.json` is required.

### One-time setup
1. <https://vercel.com> → **Add New… → Project** → import `astrabocconi-app/astra-app`.
2. **Root Directory:** `apps/web`.
3. Framework preset: **Next.js** (auto-detected). Vercel runs the workspace-aware
   install from the repo root and builds `apps/web`.
4. **Storage → Neon** (Postgres) and **Storage → Blob**, and the **Resend**
   Marketplace integration — connect them to the project. These auto-inject their
   env vars (DB connection strings, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`)
   across environments. The DB layer reads whichever DB names are present.
5. **Remaining env vars** you set manually (Project → Settings → Environment
   Variables): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (= the deployment domain),
   `CARD_TOKEN_HMAC_SECRET`, `ALLOWED_EMAIL_DOMAINS`, `MOBILE_ALLOWED_ORIGINS`,
   `SENTRY_DSN`. Pull them locally with `vercel env pull apps/web/.env`.
6. Deploy. Smoke-test `https://<deployment>/api/health` → `{"db":"up"}`.
   > The runtime client uses the **pooled** DB connection automatically; migrations
   > use the **direct** one. Both come from the injected Neon vars.

### Migrations on deploy
Run migrations against the target DB **before/at** release using the **direct**
connection:
```bash
DATABASE_URL=$DIRECT_URL npm run db:migrate:deploy -w @astra/db   # prisma migrate deploy
```
Do this from CI or locally against staging/prod — not inside the Vercel build.
The schema exists and the dev DB is migrated; run this per environment (staging,
prod) when you set them up.

### CORS
Set `MOBILE_ALLOWED_ORIGINS` to the Expo dev-client origin(s) and the production app
origin so `/api/*` accepts the mobile app.

## `apps/mobile` (Expo) → EAS

Builds are configured but **not run** by this scaffold. When ready:
```bash
cd apps/mobile
eas login
eas init                      # sets projectId (paste into app.config.ts)
eas build --profile preview      --platform android   # internal test APK
eas build --profile production   --platform all        # store builds
eas submit --profile production  --platform android    # after verifying API 36
```
- `development` → dev client (APK, internal).
- `preview` → staging URL (APK, internal distribution).
- `production` → app bundle + submit; **Android API 36** (required on Play as of
  2026-08-31 — verify the pinned Expo SDK supports it first).

## CI/CD

**Not wired yet.** The scaffold shipped a `.github/workflows/ci.yml`
(`npm ci` → `turbo run lint typecheck test build` → Prisma drift check) but it
failed on the still-scaffolded apps and was removed to unblock development. Also
note: branch protection isn't available on this private repo's plan. Reintroduce
a working pipeline (and a drift check with the Prisma 7 `--to-schema` flag +
a Postgres service) once the apps build green — see `docs/ROADMAP.md` Phase 12.
