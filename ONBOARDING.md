# ASTRA - Developer Onboarding

Get the ASTRA app running locally. This covers the monorepo, the mobile app (Expo
development build) and the web app + API. For the "why" see [`README.md`](README.md)
and [`docs/`](docs/).

> **Secrets are NOT in this repo.** Real credentials live in Vercel and the EAS
> project. Ask the team lead for access and never paste secrets in chat, e-mail
> or commits. `.env*` files are gitignored on purpose (only `*.env.example` is
> tracked).

---

## 1. Prerequisites

- **Node 24** (`nvm use` reads `.nvmrc`) and **npm 11**. Older Node does not work: the
  tests rely on `node --test --experimental-strip-types`.
- **Git** and access to the repo `astrabocconi-app/astra-app`.
- **Mobile:** the app uses native modules (Mapbox, camera, notifications), so it
  **cannot run in Expo Go**. You need a **development build**:
  - iOS Simulator (macOS, full **Xcode**, not just the Command Line Tools), or
  - a physical iPhone, see [`docs/RUNNING-ON-IPHONE.md`](docs/RUNNING-ON-IPHONE.md), or
  - an EAS `development` build (`eas build --profile development`; the free Expo
    plan has a small build queue, ask before starting one).
- A **Mapbox download token** (`RNMAPBOX_MAPS_DOWNLOAD_TOKEN`, secret, scope
  `DOWNLOADS:READ`) in your shell or `~/.netrc` for the first native build.

## 2. Clone and install

```bash
git clone https://github.com/astrabocconi-app/astra-app.git
cd astra-app
npm ci                 # one install for the whole monorepo (also runs prisma generate)
```

## 3. Environment

### Web (`apps/web/.env`)

The variable list and where each comes from is in
[`docs/SETUP.md`](docs/SETUP.md#environment-variables). The important rule:

> **Do not `vercel env pull` and use the result for development yet.** The Vercel
> *Development* and *Preview* environments currently contain the **production**
> database URL and auth secrets. Running the app, a seed or a Prisma command with
> them touches live student data. Until the owner creates separate Neon branches
> (docs/SETUP.md, "Dev and preview database"), use your own Neon branch URLs or a
> local Postgres.

```bash
cp apps/web/.env.example apps/web/.env      # fill in DATABASE_URL / DIRECT_URL of a NON-production DB,
                                            # BETTER_AUTH_SECRET, CARD_TOKEN_HMAC_SECRET
```

With no SMTP configured, the sign-in code is **printed in the `apps/web` console**.

### Mobile (`apps/mobile/.env.local`)

```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # NOT .env: EAS Build loads .env into cloud builds
```

Set `EXPO_PUBLIC_API_URL` to `http://localhost:3000` (simulator) or
`http://<your-LAN-IP>:3000` (phone), and optionally `EXPO_PUBLIC_MAPBOX_TOKEN`
(public `pk.` token) so the Discounts map renders. `EXPO_PUBLIC_*` values are
**public**, never put a secret in them. Restart Metro after changing them.

## 4. Run

```bash
npm run dev -w @astra/web          # http://localhost:3000   (/api/health -> {"status":"ok","db":"up"})
npm run dev -w @astra/mobile       # Metro for the dev client (i = iOS simulator)
```

Mobile needs the dev client installed first: `npx expo run:ios` (from `apps/mobile`)
builds and installs it.

## 5. Signing in locally

1. Enter an `@studbocconi.it` or `@unibocconi.it` e-mail, tap **Send code**.
2. Read the 6-digit code in the `apps/web` terminal.
3. Enter it.

**Dev bypass (non-production API only):** in a development build, typing
`blabmerda` as the e-mail calls `POST /api/auth/dev-login` and signs in as an
**ADMIN**. The server enables it only when `NODE_ENV !== "production"` (or
`DEV_LOGIN_ENABLED=true`), which is exactly why a dev environment must never hold
production data. `DEV_LOGIN_ENABLED` must **not** be set in Vercel Production.

To give your user backoffice access:

```sql
UPDATE "User" SET roles = ARRAY['ADMIN']::"Role"[] WHERE email = 'you@studbocconi.it';
```

## 6. Working on the project

Branch flow and commit rules: [`CONTRIBUTING.md`](CONTRIBUTING.md). Before pushing:

```bash
npm run ci          # typecheck + lint + test (same as GitHub Actions)
npm run format
```

| Command | Does |
|---|---|
| `npm run dev` | All dev servers |
| `npm run typecheck` | `prisma generate` + `tsc --noEmit` everywhere |
| `npm run lint` | ESLint (mobile, web, shared) |
| `npm test` | Unit tests |
| `npm run db:migrate:deploy` | Apply committed migrations to the DB in `apps/web/.env` |
| `npm run db:studio` | Prisma Studio |

**Never run `npm run db:migrate` (`prisma migrate dev`).** Two old migrations have
drift and `migrate dev` then wants to reset the database. Write a new
`packages/db/prisma/migrations/<timestamp>_name/migration.sql` by hand and apply it
with `migrate:deploy` (see [`docs/DEPLOY.md`](docs/DEPLOY.md#migrations)).

**Architecture rules** (details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):
- Mobile **never** touches the DB. It calls `apps/web`'s `/api/*` through the typed client in `@astra/shared`.
- **Zod** validates every API request at the boundary.
- All authorization goes through `apps/web/lib/authz.ts`.
- User-facing strings exist in Italian **and** English (`apps/mobile/lib/i18n/*`).

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Expo Go says the project is incompatible / native module missing | Expo Go is not supported, use a dev build. |
| `xcodebuild requires Xcode`, no simulators | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, open Xcode once, `xcodebuild -downloadPlatform iOS`. |
| `simctl` hangs / "server died" | `xcrun simctl shutdown all`, `killall -9 com.apple.CoreSimulator.CoreSimulatorService`, relaunch. |
| Phone can't reach the API | Point `EXPO_PUBLIC_API_URL` at your current LAN IP and restart Metro (`npx expo start -c`). |
| `EXPO_PUBLIC_*` change not applied | Restart Metro, those values are inlined at bundle time. |
| `npm test` fails with "unknown option --experimental-strip-types" | You are on Node < 22.6. Use Node 24. |
| Map shows "Map unavailable" | `EXPO_PUBLIC_MAPBOX_TOKEN` is not set for this build. |
| Every screen shows "Retry" | See the runbook in [`docs/DEPLOY.md`](docs/DEPLOY.md#runbook-every-screen-shows-retry). |
