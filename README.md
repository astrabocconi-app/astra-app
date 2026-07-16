# ASTRA App

Loyalty platform for the ASTRA ecosystem — a **monorepo** containing the student
mobile app, the admin dashboard, and the API (which lives _inside_ the web app).

> **Scaffold status.** This repository is a working skeleton so three part-time
> developers can clone it and start the same day. The **database schema, the
> business endpoints, and the full auth flow are intentionally deferred** and
> marked with `TODO(scaffold)` / `TODO(US-xxx)`. See
> [Deferred work](#deferred-work) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## What's here

| Path | What it is |
|---|---|
| `apps/mobile` | Expo (managed) student app — Expo Router, NativeWind, TanStack Query, Zustand. Two screens: OTP-login shell + a home screen that calls `GET /api/me`. |
| `apps/web` | Next.js (App Router) — the admin **dashboard** _and_ the **API** (`app/api/**/route.ts`). Hosted on Vercel. There is **no separate API service.** |
| `packages/db` | Prisma schema, migrations, seed, and the Neon client singleton. **Server-only.** |
| `packages/shared` | Zod schemas, types inferred from them, domain constants, and the typed API client the mobile app uses. |
| `packages/config` | Shared ESLint (flat), Prettier, and base `tsconfig`. |
| `docs/` | [Setup](docs/SETUP.md), [Architecture + ADRs](docs/ARCHITECTURE.md), [Deploy](docs/DEPLOY.md). |

```
astra-app/
├── apps/
│   ├── mobile/          # Expo student app
│   └── web/             # Next.js dashboard AND the API (app/api/**)
├── packages/
│   ├── db/              # Prisma + Neon client (server-only)
│   ├── shared/          # Zod schemas, inferred types, typed API client
│   └── config/          # eslint / prettier / tsconfig base
├── docs/
├── .github/workflows/
├── turbo.json
└── package.json         # npm workspaces root
```

## Stack

npm workspaces + **Turborepo** · TypeScript (strict) · **Neon** serverless Postgres ·
**Prisma** · **Next.js** Route Handlers for the API · **Better Auth** (email OTP) ·
Expo + Expo Router + NativeWind + TanStack Query + Zustand · Tailwind + shadcn/ui ·
Cloudflare **R2** (signed URLs) · **Resend** (OTP email) · **Zod** at every network
boundary · **Sentry**. No payments in Phase 1.

## Get running locally (< 10 min)

**Prerequisites:** Node ≥ 20, npm ≥ 10. (Mobile: the Expo Go app or a dev build on
your phone/simulator.)

```bash
# 1. Install everything (one install for the whole monorepo)
npm install

# 2. Configure env — copy the examples and fill in the blanks (see docs/SETUP.md)
cp apps/web/.env.example    apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env

# 3a. Run the web app + API
npm run dev -w @astra/web        # http://localhost:3000  →  /api/health

# 3b. Run the mobile app (separate terminal)
npm run dev -w @astra/mobile     # Expo dev server
```

Verify the API is up: <http://localhost:3000/api/health> → `{"status":"ok","db":"up",...}`.

> The DB schema + auth are wired (Phase 1–2). `/api/health` reports `"db":"up"`
> when it can reach Neon, so you need real Neon `DATABASE_URL` / `DIRECT_URL`
> values in `apps/web/.env` (see [docs/SETUP.md](docs/SETUP.md)). In dev, the
> email-OTP code is printed to the `apps/web` server console when no
> `RESEND_API_KEY` is set — no email account required to sign in locally.

## Running the mobile app (Expo)

`apps/mobile` is an Expo (managed) React Native app. You run a **Metro** dev
server on your machine and load the app in the **iOS Simulator** or on a
**physical phone** via **Expo Go**. The **API (`apps/web`) must be running too** —
the app calls it.

### Prerequisites

- **Node ≥ 20, npm ≥ 10**, and `npm install` run once at the repo root.
- **The web/API running:** `npm run dev -w @astra/web`.
- **iOS Simulator (macOS only):** the **full Xcode** app **plus** an iOS
  simulator runtime (see setup below). The Command Line Tools alone are **not**
  enough — you'll get `xcodebuild requires Xcode` and zero simulators.
- **Physical iPhone:** the **Expo Go** app (App Store), phone on the **same
  Wi-Fi** as your Mac.
- **Android (optional):** Android Studio + an emulator, or Expo Go on a device.

### One-time iOS Simulator setup (macOS)

Installing Xcode from the App Store is **not sufficient by itself** — you must
point the tools at it and install a simulator runtime:

```bash
# 1. Install Xcode (Mac App Store, ~15 GB). Open it once, accept the prompts.
#    Then point the command-line tools at the full Xcode:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch

# 2. Install an iOS simulator runtime (Xcode downloads these on demand):
xcodebuild -downloadPlatform iOS         # …or Xcode → Settings → Components
xcrun simctl list runtimes               # should now list "iOS <version>"
```

Expo Go is installed into the simulator **automatically** the first time you
launch — no manual step.

### Start it

```bash
# terminal 1 — the API
npm run dev -w @astra/web                 # http://localhost:3000

# terminal 2 — Metro + the app
npm run dev -w @astra/mobile              # = cd apps/mobile && expo start
#   press  i  → open in the iOS Simulator   (a → Android)
```

On the **first** iOS launch the simulator shows an *"Open in Expo Go?"* dialog —
tap **Open**. First bundle takes ~1 min; after that, saved edits hot-reload in
about a second. On the simulator the app reaches the API at `http://localhost:3000`
(`EXPO_PUBLIC_API_URL` in `apps/mobile/.env`, the default).

### Run on a physical iPhone

The phone can't reach `localhost` (that's the phone itself), so point the app at
your Mac's LAN IP:

```bash
ipconfig getifaddr en0                    # your Mac's LAN IP, e.g. 192.168.1.42
```

Set `EXPO_PUBLIC_API_URL="http://<that-ip>:3000"` in `apps/mobile/.env`, restart
Metro, then in **Expo Go** tap the server under **"Development servers"** (phone
+ Mac on the same Wi-Fi, with Expo Go's **Local Network** permission enabled).

### Signing in (local dev)

No Resend key locally → the email-OTP code is **printed to the `apps/web` server
console** instead of emailed. Enter your `@studbocconi.it` email → **Send code**
→ copy the 6-digit code from the web terminal → enter it. Only `@studbocconi.it`
addresses are accepted.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `xcodebuild requires Xcode`, no simulators | Run the `xcode-select -s …` switch above and open Xcode once. |
| `xcrun simctl list runtimes` empty after download | A corrupt/duplicate runtime can block registration: `xcrun simctl runtime list` → `xcrun simctl runtime delete <bad-id>`, then re-run `xcodebuild -downloadPlatform iOS`. |
| `simctl` commands hang / "server died" | CoreSimulator is wedged: `xcrun simctl shutdown all` then `killall -9 com.apple.CoreSimulator.CoreSimulatorService`, and relaunch. |
| Phone can't reach the API | You're on `localhost`, or the Wi-Fi reassigned your Mac's IP. Re-set `EXPO_PUBLIC_API_URL` to the current `ipconfig getifaddr en0` and restart Metro. |
| Dev server never appears in Expo Go | Same Wi-Fi + enable Expo Go's Local Network permission, or use a phone hotspot. |

> `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time — after
> changing `apps/mobile/.env` you must **restart Metro** for it to take effect.

## Main commands

Run from the repo root (Turbo fans out across workspaces):

| Command | Does |
|---|---|
| `npm run dev` | Runs all apps' dev servers |
| `npm run lint` | ESLint across the monorepo |
| `npm run typecheck` | `tsc --noEmit` across the monorepo |
| `npm run build` | Builds all buildable packages |
| `npm run format` | Prettier write |
| `npm run db:migrate` | `prisma migrate dev` (needs Neon `DIRECT_URL`) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed local data |

Target a single workspace with `-w`, e.g. `npm run dev -w @astra/web`.

## Security & boundaries (read before writing code)

- **Mobile never talks to the DB and never imports Prisma.** It calls `apps/web`'s
  `/api/*` routes over HTTPS through `@astra/shared`'s typed client. The Neon
  connection string does not exist in the mobile bundle.
- **`EXPO_PUBLIC_*` variables are public by definition** — they are inlined into the
  shipped JS bundle. Never put a secret in one. (No DB URL, no HMAC key, no API
  secret in the mobile app.)
- **Every** API request body / query param is validated with a **Zod** schema from
  `@astra/shared` before any DB code runs. No `any` at the boundary.
- **Authorization lives in one module** (`apps/web/lib/authz.ts`). We have no
  Postgres RLS, so that module _is_ the security layer. No route handler queries
  the DB without going through it.

Full rationale + ADRs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Deferred work

Tracked as `TODO(scaffold)` / `TODO(US-xxx)` in-code. Not built in this pass:

- The full Prisma schema (tables, indexes, constraints), migrations, the
  append-only `PointsLedgerEntry` + trigger, the `PointsBalance` / `MaterialStats`
  SQL views, the `DiscountUsage` generated column, PostGIS verification, seed data.
- Better Auth wiring and the real email-OTP flow (mobile + web).
- All business endpoints (as typed `501` stubs) beyond `GET /api/health`.
- `GET /api/me` currently returns `501` until auth + DB land.

## Contributing

Conventional Commits, branch flow, and PR rules: [`CONTRIBUTING.md`](CONTRIBUTING.md).
