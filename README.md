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

Verify the API is up: <http://localhost:3000/api/health> → `{"status":"ok",...}`.

> You can start the web app with **placeholder** env values — the deferred DB
> layer isn't wired yet, so `/api/health` returns `"db":"unchecked"`. Real Neon
> credentials are only needed once the schema lands.

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
