# Contributing to ASTRA

## Branches — keep it simple

There are only two branches you need to know about:

- **`develop`** — this is where everyone works. All your day-to-day work goes here.
- **`main`** — production. You never touch this directly. Code only gets here after
  Michele reviews and approves it.

**The whole flow:**

1. **Always** get the latest code before you start working. Make sure you're on
   `develop` and up to date:
   ```bash
   git checkout develop
   git fetch
   git pull
   ```
   Do this every time you sit down to work — it avoids conflicts with what
   others have already pushed.
2. Do your work, commit it (see commit format below), and push to `develop`:
   ```bash
   git push
   ```
3. That's it. When a chunk of work is ready to ship, Michele reviews everything
   on `develop` and promotes it to `main`.

You don't need to create your own branches or open PRs against `main`. Just work
on `develop`. If you're ever unsure, ask before pushing.

## Commits — [Conventional Commits](https://www.conventionalcommits.org/)

```
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`.
**Scopes** (typical): `web`, `mobile`, `db`, `shared`, `config`, `ci`.

Examples:

```
feat(db): add PointsLedgerEntry (append-only) + PointsBalance view
fix(web): validate @studbocconi.it before sending OTP
docs(architecture): ADR for API-inside-Next.js
```

Reference the backlog story where relevant: `feat(web): US-002 GET /api/me`.

## Before you push (always)

Run these and make sure they pass — don't push red code onto `develop`:

```bash
npm run format
npm run ci          # typecheck + lint + unit tests, same as GitHub Actions
```

Node 24 is required (`nvm use`).

## Tests

Unit tests use the built-in runner (`node --test --experimental-strip-types`), no
framework. Put `*.test.mjs` next to the code: `apps/web/lib/*.test.mjs`,
`packages/shared/src/*.test.mjs`, `apps/mobile/lib/**/*.test.mjs`. Run everything
with `npm test`, one package with `npm test -w @astra/web`. Any change to logic with
a branch, money, points, authorization or parsing leaves at least one test behind.
Pure logic (calculators, token signing, time helpers) belongs in `@astra/shared` or a
side-effect-free module so it can be tested without a database.

Never run tests, seeds or scripts against the production database (see
[`docs/SETUP.md`](docs/SETUP.md)).

## Going to production (Michele only)

Contributors don't do this — it's here so you know what happens to your work.

When `develop` is ready to ship, Michele opens a release PR (`develop → main`)
and reviews it before merging. GitHub Actions (the workflow in `docs/ci-workflow.yml`, once enabled — see docs/DEPLOY.md) runs
typecheck, lint and tests on every push and pull request; it must be green. The
release steps (web deploy, EAS build and submit, OTA, migrations) are in
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Code rules (non-negotiable)

- **Validate at the boundary.** Every API input parsed with a Zod schema from
  `@astra/shared` (`safeParse`) before any DB access. No `any` at the boundary.
- **Types are inferred from Zod** (`z.infer<…>`), never hand-duplicated.
- **Authorization** goes through `apps/web/lib/authz.ts` — never inline in a route.
- **No server secrets in client code or the mobile bundle.** `EXPO_PUBLIC_*` is public.
- **Mobile never imports Prisma / `@astra/db`.** It only calls `/api/*`.
- Never commit a real `.env` — only `*.env.example`.
