# ASTRA — Deploy

## `apps/web` (dashboard + API) → Vercel

The web app is a standard Next.js App Router project inside a Turborepo monorepo.
No `vercel.json` is required.

### One-time setup
1. <https://vercel.com> → **Add New… → Project** → import `astrabocconi-app/astra-app`.
2. **Root Directory:** `apps/web`.
3. Framework preset: **Next.js** (auto-detected). Vercel runs the workspace-aware
   install from the repo root and builds `apps/web`.
4. **Environment variables** — add everything from `apps/web/.env.example` for each
   Vercel environment:
   - **Production** → your prod Neon (pooled `DATABASE_URL` + `DIRECT_URL`), prod
     Resend/R2/Sentry keys, `BETTER_AUTH_URL` = the production domain.
   - **Preview** → staging Neon (or a per-PR **Neon branch** — see
     [SETUP.md](SETUP.md)), staging secrets.
   - **Development** (optional) → dev Neon.
   > `DATABASE_URL` must be the **pooled** (`-pooler`) string on Vercel — serverless
   > functions exhaust unpooled connections.
5. Deploy. Smoke-test `https://<deployment>/api/health`.

### Migrations on deploy
Run migrations against the target DB **before/at** release using the **direct**
connection:
```bash
DATABASE_URL=$DIRECT_URL npm run db:migrate:deploy -w @astra/db   # prisma migrate deploy
```
Do this from CI or locally against staging/prod — not inside the Vercel build.
(Deferred until the schema exists.)

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

`.github/workflows/ci.yml` runs on PRs/pushes to `main` and `develop`:
`npm ci` → `turbo run lint typecheck test build` → Prisma migration drift check.
Branch protection on `main` requires this to be green + 1 approval.
