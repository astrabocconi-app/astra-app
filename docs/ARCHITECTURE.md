# ASTRA — Architecture

This document records the load-bearing decisions and the rules that keep the
system safe as three part-time developers build on it. Short ADRs are at the end.

## Shape of the system

```
┌─────────────┐   HTTPS (typed client in @astra/shared)   ┌──────────────────────────┐
│ apps/mobile │ ────────────────────────────────────────▶ │ apps/web                 │
│ (Expo)      │            /api/*                          │  ├─ dashboard (RSC/React)│
│             │ ◀──────────────────────────────────────── │  └─ API (app/api/**)     │
└─────────────┘             JSON                           └──────────┬───────────────┘
                                                                       │ Prisma (server-only)
                                                                       ▼
                                                              ┌──────────────────┐
                                                              │ Neon Postgres     │
                                                              │ (pooled + direct) │
                                                              └──────────────────┘
```

- **The API is not a separate service.** It is `apps/web/app/api/**/route.ts`. The
  mobile app calls `apps/web`'s deployed URL directly.
- **`packages/shared` is the contract.** Zod schemas + inferred types + the typed
  client live there and are imported by both sides.
- **`packages/db` is server-only.** It owns Prisma + the Neon client singleton.

## Rules (enforced, not aspirational)

### 1. Mobile never touches the DB
The mobile app must never import `@astra/db` / Prisma and must never hold the Neon
connection string. Its **only** data path is the typed client in
`@astra/shared/client`, which speaks HTTPS to `/api/*`. This keeps DB credentials
out of a bundle that ships to untrusted devices.

### 2. Validate everything at the boundary (Zod)
Every request body and query param handled by a route in `apps/web/app/api` is
parsed with a Zod schema from `@astra/shared` (`safeParse`) **before** any DB code
runs. TypeScript types vanish at runtime; they will not stop a malformed request
from an old app build from reaching the DB. **No `any` at the boundary.** Types are
inferred from the schemas (`z.infer<…>`) and never hand-duplicated.

### 3. Authorization is one module — it is the security layer
We do **not** use Postgres Row-Level Security. Therefore `apps/web/lib/authz.ts` is
the security layer. All authorization rules live there; no route handler may query
the DB without an explicit check from it. Deny-by-default once implemented.

### 4. The server/client boundary inside one Next.js app
Because the API lives inside the Next.js app, two leaks must be actively prevented:
- Route handlers must **not** import client-only React code.
- Server-only env vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`, Blob token / HMAC secrets) must
  **not** be imported into any file that can end up in a client bundle. Keep them in
  server modules (`lib/*.ts` used only by route handlers / server components).
  `packages/db` and `@prisma/client` are listed in `serverExternalPackages` in
  `next.config.ts` so they never get bundled for the browser.

## Data model (implemented)

The full schema lives in `packages/db/prisma/schema.prisma`, applied via the init
migration (the raw-SQL parts Prisma can't express are documented in
`packages/db/prisma/sql/`). Key decisions:

- **Points are append-only.** `PointsLedgerEntry(id, userId, delta, kind, reason,
  refType, refId, createdAt)` with **no mutable balance column anywhere**. Balances
  are a **`PointsBalance` SQL view** aggregating the ledger per user + `kind`. Prisma
  doesn't manage views natively → create via a raw-SQL migration and map with a
  `Prisma.$queryRaw` helper or an `@@ignore`d model.
- **Immutability at the DB level.** A trigger / revoked grant must block
  `UPDATE`/`DELETE` on `PointsLedgerEntry` (raw SQL in a migration). Document the
  Postgres role used.
- **`MaterialStats` view: aggregated counts only, never per-user rows** — protects
  student privacy from Head Media.
- **`DiscountUsage`** has a Postgres **generated** `usageDate` (`usedAt::date`)
  with `@@unique([userId, offerId, usageDate])` — one use per offer per day.
  Generated columns require an IMMUTABLE expression, so the day is **UTC** (not
  Rome-local); Prisma maps it as `@default(dbgenerated(...))` and never writes it.
- **Geo / partner radius:** PostGIS is not on every Neon config. Verify with
  `CREATE EXTENSION postgis` in a migration; if unavailable, fall back to
  `earthdistance`/`cube` or a haversine calculation in raw SQL. Record the choice
  here when implemented.
- **Soft deletes** via `deletedAt`; **consent** stored with a text `policyVersion`,
  not a boolean.
- Better Auth's own tables (`Session`, `Account`, `Verification`) are generated
  by its CLI and included in the schema/migration.

## Auth (implemented)

Better Auth with the **email-OTP** and **bearer** plugins, Prisma adapter, tables
on Neon (`apps/web/lib/auth.ts`). Allowed domains (`@studbocconi.it` /
`@unibocconi.it`, configurable via `ALLOWED_EMAIL_DOMAINS`) are validated
**server-side before** an OTP is issued — enforced in a `before` hook so Better
Auth's anti-enumeration "silent success" for unknown emails can't bypass it.
Sends are rate-limited (max 3/min). Delivery is via **Resend**, or logged to the
server console in dev when no `RESEND_API_KEY` is set. The mobile app
authenticates with a **Bearer token** (not cookies) via `@astra/shared`'s client.

---

## ADRs

### ADR-001 — Neon (not Supabase), provisioned via Vercel
**Decision:** Neon serverless Postgres, provisioned through **Vercel → Storage** so
Vercel manages and injects the connection env vars. **Why:** we need serverless
Postgres with cheap per-PR **branch** databases and pooled connections for Vercel
functions; we don't need Supabase's bundled auth/storage/realtime (we use Better
Auth + **Vercel Blob**). Consolidating infra under Vercel means one dashboard and
`vercel env pull` instead of hand-managed secrets. The DB layer reads both our env
names and Vercel's injected ones (see `packages/db`).

### ADR-002 — The API lives inside Next.js (no separate backend)
**Decision:** the API is `apps/web/app/api/**`; no Hono/Express/Fastify service.
**Why:** for a 3-person part-time team, one app to deploy and configure beats a
framework boundary duplicated between "the API" and "the dashboard." **Trade-off:**
API and dashboard deploy together and scale together — acceptable at pilot scale.

### ADR-003 — Authorization in a shared module, not RLS
**Decision:** all authz in `apps/web/lib/authz.ts`; no Postgres RLS. **Why:** RLS
spreads policy into the DB and is easy to get subtly wrong under a shared connection
pool; a single typed module is reviewable, testable, and lives next to the code that
uses it. **Cost:** discipline — every DB access must route through it (enforced in
review + lint intent).

### ADR-004 — Prisma
**Decision:** Prisma for schema, migrations, and typed access. **Why:** best-in-class
DX and migration tooling for a team ramping up fast; `prisma migrate diff` can power
a schema-vs-migrations drift check (to be re-added to CI). Views/triggers it can't
model are handled with raw-SQL migrations.

### ADR-005 — Admin work during the pilot without a full panel
**Decision:** the dashboard is a **skeleton** in Phase 1; real admin actions happen
via seeded roles, Prisma Studio, and targeted scripts/endpoints as needed. **Why:**
building a full admin panel now would dwarf the pilot's actual scope. The nav for the
planned sections exists so the shape is agreed; pages fill in as stories land.

### ADR-006 — TypeScript 5.9, not 7.0
**Decision:** pin TypeScript `5.9.x`. **Why:** at scaffold time npm's `latest` for
`typescript` was `7.0` (the new native compiler), but `typescript-eslint@8` (and the
rest of the toolchain) still peer-require `<6.1`. 5.9 is the newest line the whole
stack supports. Revisit once typescript-eslint ships TS7 support.
