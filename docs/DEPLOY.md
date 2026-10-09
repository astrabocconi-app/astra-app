# ASTRA - Deploy and runbook

Production is **one** Vercel project (web + API), **one** Neon database and the
iOS app on TestFlight / App Store. There is no staging database yet (see
[SETUP.md](SETUP.md#dev-and-preview-database-owner-action-strongly-recommended)),
so be deliberate.

## Hosts

| Host | Role |
|---|---|
| `https://app.astrabocconi.com` | Custom domain, the canonical API and web URL. New app builds use it (`apps/mobile/eas.json`, `app.config.ts`). |
| `https://astra-app-cyan.vercel.app` | Original Vercel hostname. **Builds already installed on phones call it, so it must keep working forever** (keep it as an alias of the production deployment). |

Both serve the same deployment (same `/api/health` and `/privacy`). Smoke test
either one: `curl https://app.astrabocconi.com/api/health` returns
`{"status":"ok","db":"up",...}`.

## Web (`apps/web`) to Vercel

Standard Next.js on a Turborepo. Project settings: **Root Directory** `apps/web`,
framework Next.js, Node 24, `apps/web/vercel.json` pins region `fra1`. Vercel runs
the build through turbo, so any variable the build needs must be listed in the
root `turbo.json` (`globalPassThroughEnv`).

Environment variables are inventoried in [SETUP.md](SETUP.md#environment-variables).

### Release checklist

1. Work on a clean, committed tree on the commit you want to ship. CI
   (`docs/ci-workflow.yml`, once enabled) must be green: `npm run ci` locally gives the same answer.
2. Apply any new **migration first** (next section), because the code that needs a
   column must not go out before the column exists. Prefer migrations that are
   additive and backward compatible with the currently deployed code.
3. Deploy: `vercel --prod` from the repo root (or push, once the Git integration is
   connected). `vercel --prod` occasionally fails once with "Not authorized": retry.
4. Smoke test `/api/health`, open the backoffice, load a screen in the app.
5. Note the commit hash next to the deployment. If it goes wrong, **Vercel >
   Deployments > Promote/Rollback** to the previous Ready deployment is the fastest fix.

Deploys from the CLI upload the local working copy, not a Git commit: only deploy
from a clean tree, otherwise production cannot be traced back to a commit.

### Cron jobs

Once the backend-hardening release is deployed, `apps/web/vercel.json` declares the
scheduled maintenance jobs (session and image cleanup, token pruning, and the like;
if `vercel.json` has no `crons` block yet, they have not shipped). Vercel calls `/api/cron/*` with
`Authorization: Bearer <CRON_SECRET>`; set `CRON_SECRET` in Production before the
release that introduces them, otherwise the jobs answer 401. Hobby allows one run
per job per day. Check runs in Vercel > Project > Cron Jobs, and trigger one by hand
with `curl -H "Authorization: Bearer $CRON_SECRET" https://app.astrabocconi.com/api/cron/<job>`.

## Migrations

Migrations are plain SQL folders in `packages/db/prisma/migrations/`. They are
**hand-written and applied with `migrate deploy`**:

```bash
# apps/web/.env must point at the TARGET database (direct/unpooled URL)
npm run db:migrate:deploy          # = prisma migrate deploy in @astra/db
```

- **Never** run `npm run db:migrate` (`prisma migrate dev`) or `prisma migrate reset`.
  Two old migrations have drift, so `migrate dev` proposes to reset the database.
- SQL files must be LF (`.gitattributes` enforces it): Prisma stores a checksum per
  migration and CRLF changes it.
- Before applying to production: take a Neon restore point (create a branch from
  `main` at "now"; it is instant), run the migration on a **branch of production**
  first, then on production.
- Migrations are applied by hand, by one person, **before** the web deploy that needs
  them.
- One-off data fixes: write a throwaway script, run it, delete it. Never leave scratch
  scripts that can write to the database checked in.

### Production cleanup scripts

Maintenance scripts live in `packages/db/scripts/` (data clean-up, test-account
removal). Rules for running any of them:

1. Read the script header: it states what it deletes and whether it has a dry-run
   mode. Run the dry-run (or read-only mode) first and keep the output.
2. Create a Neon restore point first (branch from production, see Backups).
3. Run from `packages/db` with `apps/web/.env` pointing at production, typically
   `npx tsx scripts/<name>.ts` (add the flag documented in the header to actually
   apply it). Do it from your own machine, never from CI.
4. Re-check `/api/health` and the backoffice KPIs afterwards.

## Mobile (`apps/mobile`)

Free Expo plan: builds are queued and limited, **never start one by habit**.

### Store build and submit

```bash
cd apps/mobile
# 1. bump "version" in app.config.ts (App Store Connect closes a version once a build
#    under it was submitted; buildNumber increments by itself)
eas build --platform ios --profile production
eas submit --platform ios --profile production   # key from apps/mobile/secrets/, ascAppId in eas.json
```

Then in App Store Connect: add the build to the version, answer the compliance
questions (encryption is already declared exempt), fill the App Privacy answers
(see below) and submit for review. Put review access notes in the submission: the
demo account (`DEMO_REVIEW_EMAIL` / `DEMO_REVIEW_OTP`) and that the Info.plist
location text exists only because the bundled map SDK references location APIs and
the app never requests it.

Builds needing environment values (`EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_MAPBOX_TOKEN`,
`RNMAPBOX_MAPS_DOWNLOAD_TOKEN`, optionally `SENTRY_AUTH_TOKEN`) read them from the EAS
project environment; check with `eas env:list production` before building.

### OTA updates (expo-updates)

JS-only fixes can skip store review once a build **containing expo-updates** is in
users' hands.

- Config: `app.config.ts` (`updates`, `runtimeVersion: appVersion`) and a `channel`
  per profile in `eas.json`.
- One-time: the module must be installed and shipped in a native build:
  `cd apps/mobile && npx expo install expo-updates`, verify with
  `npx expo config --type public`, then include it in the next store build.
- Publish a fix: `cd apps/mobile && eas update --channel production --message "what changed"`.
  An update only reaches builds with the **same runtime version** (= the app
  `version`), so bump `version` whenever native code or native dependencies change.
- Roll back: publish the previous commit again (`eas update:republish` or a new update).
- OTA must not carry native changes, new permissions or config-plugin changes.

### App Store privacy answers (derived from the code)

Contact info (e-mail, name) · Identifiers (user id, push token) · User content
(support messages) · Other data (academic programme and year, points and redemption
history) · Diagnostics (crash and performance data from Sentry, not linked to the
user: `setUser` is never called). **Location: not collected. Tracking: none** (no
ATT prompt). Photos/video/audio: none (camera frames are not stored). The privacy
policy page (`apps/web/app/privacy`) must say the same.

## CI

`docs/ci-workflow.yml` runs `npm ci`, typecheck, lint and tests on every push and
pull request, with no secrets. It is not active yet: the token used for pushes lacks
GitHub's `workflow` scope, so GitHub refuses to create files under `.github/workflows/`.
To turn it on, run `gh auth refresh -h github.com -s workflow`, then
`git mv docs/ci-workflow.yml .github/workflows/ci.yml` and push (or add the file in the
GitHub web UI). Branch protection and required checks are a GitHub
settings action (the repo plan decides whether it is available).

## Backups and restore

Neon keeps point-in-time history for a limited window that depends on the plan
(about 6 hours on Free, 7 days on Launch). **The owner must confirm the plan and the
window in the Neon console** and write it here. The points ledger is the only
record of the points economy.

- Restore point before risky work: Neon console > Branches > Create branch from
  `main` at the current time (or "restore" to a timestamp).
- Restore: use Neon's *Restore* to a timestamp or promote a branch, then update the
  Vercel connection strings if the endpoint changed, redeploy, check `/api/health`.
- Do a restore drill at least once before the App Store launch.
- Recommended: a periodic `pg_dump` of the ledger and redemption tables to storage the
  association controls.

## Runbook: every screen shows "Retry"

1. `curl https://app.astrabocconi.com/api/health`. `db: down` or no answer means a
   Neon or Vercel outage: check the Neon console, <https://www.vercel-status.com>, and
   whether the Neon project is suspended or over quota.
2. Check the error body the app got: every API response carries a `requestId`
   (header `x-request-id` and in the JSON error). In Vercel > Logs, search the
   request id: each request writes one JSON line with route, status and duration.
   - **401 on every call**: the session is invalid (secret rotated, `BETTER_AUTH_SECRET`
     changed, or the user was signed out). The app signs the user out and shows the login.
   - **500s**: the log line carries the error. Typical causes: a deploy that needs a
     migration that was not applied, a missing environment variable, a database
     connection limit.
   - **502 on the materials/guides screens only**: Supabase is unreachable or the key is wrong.
   - **Timeouts (504)**: Neon cold start or a slow function; retry once.
3. Last good deployment: Vercel > Deployments > Rollback.
4. If only one host fails (`astra-app-cyan.vercel.app` vs `app.astrabocconi.com`), the
   domain or alias is misconfigured: re-attach it in Vercel > Domains.
5. Check the Sentry project for a matching spike (mobile crash or request failures).

## Runbook: revoke a staff or admin session

Backoffice sessions are rows in the `Session` table (Better Auth).

- **A staff/partner/student user**: in the backoffice disable or demote the account
  (Team page), and delete their sessions, from `packages/db` with a one-off script or
  Prisma Studio: `DELETE FROM "Session" WHERE "userId" = '<id>'`. Roles are checked on
  each request, so demoting takes effect immediately; deleting the session also logs
  them out.
- **The environment admin**: change `ADMIN_PASSWORD_HASH` (new hash from
  `node apps/web/scripts/create-admin.mjs`) and redeploy, then delete that user's
  `Session` rows. To invalidate **every** session of every user, rotate
  `BETTER_AUTH_SECRET` (this signs everyone out, including students).
- A suspected leaked card QR: card tokens are signed with `CARD_TOKEN_HMAC_SECRET` and
  expire after about 15 minutes; rotating the secret invalidates all of them.

## Plans and ownership

The Vercel project is on a personal Hobby team and the EAS project belongs to
`mfmatozza`. Before the App Store release the owner should move both to
association-owned accounts (Vercel Pro team, Expo organisation). The custom domain
makes that move invisible to the app, provided `app.astrabocconi.com` is moved with
it and `astra-app-cyan.vercel.app` stays an alias.
