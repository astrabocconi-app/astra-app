# ASTRA App

The app of ASTRA, the Bocconi University student association (Milan). A **monorepo**
with the student mobile app (iOS first, Android later), the staff **backoffice**
and the **API** (which lives _inside_ the web app).

> **Status.** The mobile app is live on TestFlight with real students (current
> version in `apps/mobile/app.config.ts`, App Store release in preparation).
> Shipped features: email-OTP sign-in (Bocconi domains only), onboarding with
> academic profile, names and generated avatars, loyalty **card** (QR) and points
> ledger, **Discounts** map and partner venues (Mapbox), **rewards** and
> redemptions, **events** with in-app Eventbrite discounts, **news** with push
> notifications, **Academics** (course guides, handouts, materials, grade
> **calculators** and master-admissions calculator, free classrooms), in-app
> support, account deletion, and the partner scanner. The backoffice covers
> events, news, partners and partner logins, rewards and codes, points, push,
> users, staff, support inbox and an audit log. There is no gradebook any more.

---

## What's here

| Path | What it is |
|---|---|
| `apps/mobile` | Expo SDK 57 / React Native 0.86 student app (Expo Router, NativeWind, TanStack Query, Zustand). Needs a **development build**, Expo Go cannot run it (native Mapbox, camera, push). |
| `apps/web` | Next.js (App Router): the **backoffice** (`/dashboard`) _and_ the **API** (`app/api/**/route.ts`), plus the public landing, `/privacy` and `/support` pages. Hosted on Vercel (`fra1`). **There is no separate API service.** |
| `packages/db` | Prisma schema, migrations, seeds, Neon client singleton. **Server-only.** |
| `packages/shared` | Zod schemas, inferred types, domain constants, pure calculators (grades, master admissions), time helpers and the typed API client the mobile app uses. |
| `packages/config` | Shared ESLint (flat), Prettier and base `tsconfig`. |
| `bocconi-scraper` | Standalone Python/Node tooling that builds the course and handout catalogue. **Outside the npm workspaces**, own lockfile. |
| `docs/` | [Setup](docs/SETUP.md), [Architecture](docs/ARCHITECTURE.md), [Deploy and runbook](docs/DEPLOY.md), [Roadmap](docs/ROADMAP.md), [iPhone dev build](docs/RUNNING-ON-IPHONE.md), [Session handoff](docs/SESSION_HANDOFF.md). |

```
astra-app/
├── apps/
│   ├── mobile/          # Expo student app
│   └── web/             # Next.js backoffice AND the API (app/api/**)
├── packages/
│   ├── db/              # Prisma + Neon client (server-only)
│   ├── shared/          # Zod schemas, calculators, typed API client
│   └── config/          # eslint / prettier / tsconfig base
├── bocconi-scraper/     # catalogue tooling (not a workspace)
├── docs/
├── docs/ci-workflow.yml # CI workflow, ready to copy to .github/workflows/ (see docs/DEPLOY.md)
├── turbo.json
└── package.json         # npm workspaces root
```

## Stack

npm workspaces + **Turborepo** · TypeScript (strict) · **Neon** serverless Postgres ·
**Prisma 7** · **Next.js 16** Route Handlers for the API · **Better Auth** (email OTP
and Bearer tokens) · Expo + Expo Router + NativeWind + TanStack Query + Zustand ·
**Mapbox** (`@rnmapbox/maps`) · **Vercel** (hosting) · **Supabase** (public storage
for guide and handout files, read through the catalogue) · **Aruba SMTP** (OTP
e-mail, with an optional second mailbox as failover; Resend is a dead fallback that
is only used if no SMTP is configured) · **Eventbrite** (ticket checkout, in a
browser sheet) · **Zod** at every network boundary · **Sentry** (mobile only).

## Get running locally

**Prerequisites:** Node **24** (`nvm use`, see `.nvmrc`), npm 11, and for the phone
an iOS development build (see [docs/RUNNING-ON-IPHONE.md](docs/RUNNING-ON-IPHONE.md)).

```bash
npm ci                           # whole monorepo; also runs `prisma generate`

# Web + API
cp apps/web/.env.example apps/web/.env     # then fill in a NON-PRODUCTION database, see below
npm run dev -w @astra/web        # http://localhost:3000  ->  /api/health

# Mobile (separate terminal)
cp apps/mobile/.env.example apps/mobile/.env.local   # .env.local, never .env
npm run dev -w @astra/mobile     # Expo dev server for a dev client
```

> **Never point `apps/web/.env` at the production database.** At the time of
> writing the Vercel *Preview* and *Development* environments still share the
> production Neon credentials, so `vercel env pull` would hand you production.
> Use a Neon **branch** of your own (see [docs/SETUP.md](docs/SETUP.md)). In local
> dev the OTP code is printed in the `apps/web` console when no SMTP is set.

## Everyday commands (repo root)

| Command | What it does |
|---|---|
| `npm run dev` | All dev servers (turbo) |
| `npm run typecheck` | `prisma generate`, then `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint in mobile, web and shared |
| `npm test` | Unit tests (`node --test`) in web and shared (and mobile if tests exist) |
| `npm run ci` | typecheck + lint + test, exactly what GitHub CI runs |
| `npm run format` / `format:check` | Prettier |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate:deploy` | Apply committed migrations (the **only** safe migrate command, see docs/DEPLOY.md) |
| `npm run db:studio` | Prisma Studio |

`npm run db:migrate` runs `prisma migrate dev`, which can propose to **reset** a
database that has drift. Do not run it against anything you care about.

## Releasing

Web is deployed to Vercel, mobile through EAS (build, submit, optional OTA
updates). The step-by-step is in [docs/DEPLOY.md](docs/DEPLOY.md), together with
the runbook (diagnosing outages, revoking sessions, migrations, backups).

## Conventions

Branches, commits and code rules are in [CONTRIBUTING.md](CONTRIBUTING.md); new
developers start with [ONBOARDING.md](ONBOARDING.md); the architectural rules and
decisions are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
