# ASTRA — Developer Onboarding

Get the ASTRA app running locally in ~15 minutes. This covers the monorepo, the
mobile app (Expo), and the web app + API. For the deep "why", see
[`README.md`](README.md) and [`docs/`](docs/).

> **Secrets are NOT in this file.** The `.env` files hold live dev credentials
> (Neon DB, auth signing keys). Get them from the team lead via a **secure
> channel** (shared password manager / encrypted DM) — never commit or paste
> them in chat/email. `.env` files are gitignored on purpose.

---

## 1. Prerequisites

- **Node ≥ 20** and **npm ≥ 10** (`node -v`, `npm -v`).
- **Git** + access to the private repo `astrabocconi-app/astra-app`.
- **To run the mobile app on the iOS Simulator (macOS):** the **full Xcode** app
  (Mac App Store) — the Command Line Tools alone are not enough. See §5.
- **To run on a physical phone:** the **Expo Go** app (App Store / Play Store).

## 2. Clone & install

```bash
git clone https://github.com/astrabocconi-app/astra-app.git
cd astra-app
npm install            # one install for the whole monorepo (Turborepo)
```

## 3. Environment files (get the values from the team lead)

Create these two files (they're gitignored — they won't appear in `git status`):

- **`apps/web/.env`** — server secrets (DB, auth, Resend, R2, Sentry).
- **`apps/mobile/.env`** — public config only (API URL, Sentry DSN, `APP_ENV`).

Each has a committed template you can copy for the shape:

```bash
cp apps/web/.env.example    apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Then fill in the real values from the team lead. The DB URL and auth secrets are
**shared dev values** (everyone points at the same Neon dev database). The
`RESEND_API_KEY`, `R2_*`, and `SENTRY_DSN` are filled in as those accounts come
online — placeholders are fine until then (OTP codes print to the server
console in dev; see §6).

## 4. Run the app

```bash
# terminal 1 — web dashboard + API
npm run dev -w @astra/web            # http://localhost:3000

# terminal 2 — mobile (Metro + Expo)
npm run dev -w @astra/mobile
#   press  i  → open in the iOS Simulator   (a → Android)
```

Sanity check the API: <http://localhost:3000/api/health> → `{"status":"ok","db":"up",...}`.

The database schema is already migrated on the shared Neon dev DB, so you don't
need to run migrations to start. (If you change the Prisma schema, see §7.)

## 5. One-time iOS Simulator setup (macOS)

Installing Xcode is **not enough by itself** — point the tools at it and install
a simulator runtime:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
xcodebuild -downloadPlatform iOS      # or: Xcode → Settings → Components
xcrun simctl list runtimes            # should list an "iOS <version>"
```

Expo Go is installed into the simulator automatically on first launch — on that
first launch tap **"Open"** on the *"Open in Expo Go?"* dialog.

**Physical iPhone instead:** the phone can't reach `localhost`, so set
`EXPO_PUBLIC_API_URL="http://<your-mac-LAN-IP>:3000"` in `apps/mobile/.env`
(`ipconfig getifaddr en0`), restart Metro, and open the dev server in Expo Go
(same Wi-Fi, Local Network permission on).

## 6. Signing in (local dev)

No Resend key locally → the email-OTP code is **printed to the `apps/web` server
console** instead of emailed:

1. Enter your `@studbocconi.it` or `@unibocconi.it` email → **Send code** (only these domains are accepted).
2. Copy the 6-digit code from the `apps/web` terminal.
3. Enter it → you're in.

**Dev bypass (local only):** in a dev build you can skip OTP entirely — type
**`blabmerda`** in the email field and tap the button. This hits
`POST /api/auth/dev-login`, which creates/returns an **ADMIN** session.
It works **only** against a local (`NODE_ENV !== production`) API and only in dev
builds of the app — it's disabled on every deployment, so it's not a prod hole.

To give yourself dashboard/admin access, promote your user after first sign-in:

```sql
UPDATE "User" SET roles = ARRAY['ADMIN']::"Role"[] WHERE email = 'you@studbocconi.it';
```

## 7. Working on the project

Branch flow and commit rules: [`CONTRIBUTING.md`](CONTRIBUTING.md) — work on
`develop`, PR to `main`. Roadmap of what's built / what's next:
[`docs/ROADMAP.md`](docs/ROADMAP.md).

Common commands (from repo root; Turbo fans out across workspaces):

| Command | Does |
|---|---|
| `npm run dev` | All dev servers |
| `npm run typecheck` | `tsc --noEmit` across the monorepo |
| `npm run lint` | ESLint across the monorepo |
| `npm run db:migrate` | Prisma migrate (needs `DIRECT_URL`) |
| `npm run db:studio` | Browse the DB (Prisma Studio) |
| `npm run db:seed` | Seed local/dev data |

**Architecture rules to know before writing code** (full detail in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):
- Mobile **never** touches the DB — it calls `apps/web`'s `/api/*` via the typed
  client in `@astra/shared`.
- **Zod** validates every API request at the boundary.
- All authorization goes through `apps/web/lib/authz.ts` (no route queries the DB
  without it).

## 8. Troubleshooting (mobile)

| Symptom | Fix |
|---|---|
| `xcodebuild requires Xcode`, no simulators | Run the `xcode-select -s …` switch in §5; open Xcode once. |
| `xcrun simctl list runtimes` empty | Delete a corrupt runtime (`xcrun simctl runtime list` → `... runtime delete <id>`) and re-run `xcodebuild -downloadPlatform iOS`. |
| `simctl` hangs / "server died" | `xcrun simctl shutdown all` then `killall -9 com.apple.CoreSimulator.CoreSimulatorService`; relaunch. |
| Phone can't reach the API | Point `EXPO_PUBLIC_API_URL` at your current LAN IP and restart Metro. |
| `EXPO_PUBLIC_*` change not taking effect | Restart Metro — those values are inlined at bundle time. |
