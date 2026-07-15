# Contributing to ASTRA

## Branches

- `main` — production. Protected: no direct pushes, PR + 1 approval + green CI.
- `develop` — integration branch for the pilot.
- Work on short-lived branches off `develop`:
  - `feat/US-012-material-upload`
  - `fix/otp-rate-limit`
  - `chore/ci-cache`

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

## Pull requests

1. Branch off `develop`, keep it focused.
2. `npm run lint && npm run typecheck && npm run build` must pass locally.
3. Open the PR against `develop` (release PRs `develop → main`).
4. Fill in the description: what, why, how tested. Link the user story.
5. At least **1 approval** and **green CI** are required to merge.
6. Squash-merge; the squash title must be a valid Conventional Commit.

## Code rules (non-negotiable)

- **Validate at the boundary.** Every API input parsed with a Zod schema from
  `@astra/shared` (`safeParse`) before any DB access. No `any` at the boundary.
- **Types are inferred from Zod** (`z.infer<…>`), never hand-duplicated.
- **Authorization** goes through `apps/web/lib/authz.ts` — never inline in a route.
- **No server secrets in client code or the mobile bundle.** `EXPO_PUBLIC_*` is public.
- **Mobile never imports Prisma / `@astra/db`.** It only calls `/api/*`.
- Never commit a real `.env` — only `*.env.example`.

## Before you push

```bash
npm run format
npm run lint
npm run typecheck
```
