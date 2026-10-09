# Session handoff

What a fresh developer (or a fresh Claude Code session) needs to know before
touching this repo. Kept short on purpose: history is in `git log`, plans in
[`ROADMAP.md`](ROADMAP.md), procedures in [`DEPLOY.md`](DEPLOY.md).

## State

- Mobile app: the version in `apps/mobile/app.config.ts` is what is on TestFlight
  (1.1.x at the time of writing); the App Store release is being prepared.
- Production: one Vercel project, one Neon database, host `app.astrabocconi.com`
  (and the legacy `astra-app-cyan.vercel.app`, which installed builds still call and
  which must stay up).
- Preview and Development Vercel environments currently share the **production**
  database credentials. Treat every local run with a pulled env as production
  until the owner has created the Neon dev branch (SETUP.md).

## Operational gotchas

- **Never run `prisma migrate dev` / `migrate reset`.** Two old migrations have drift
  and `migrate dev` wants to reset the whole database. Write
  `migrations/<timestamp>_name/migration.sql` by hand and apply with
  `npm run db:migrate:deploy`.
- Keep migration files LF (the repo has a `.gitattributes`); Prisma checks checksums.
- `vercel --prod` occasionally fails once with "Not authorized": retry.
- **OTA is prepared but not live until a build containing `expo-updates` ships**
  (DEPLOY.md). Until then every mobile change needs `eas build` + `eas submit`.
- App Store Connect closes a version once a build under it is submitted: bump
  `version` in `app.config.ts` per submission round; `buildNumber` auto-increments.
- The Expo plan is free: do not start builds casually.
- One-off DB scripts are written as throwaway files, run once, then deleted.
  Maintenance scripts that stay live in `packages/db/scripts/` (DEPLOY.md).
- The Windows working copy is CRLF unless `.gitattributes` has been applied
  (`git add --renormalize .` once). Shell scripts must be LF.
- Do not enable or change the admin second factor settings without the owner
  (`ADMIN_2FA_ENABLED`, see SETUP.md).

## Open content threads

- New Signorvino venues need real addresses and map pins (set in the backoffice).
- The Greenmill offer still has placeholder copy.
- App name is inconsistent across surfaces: store name `ASTRA`, web pages say `myAstra`
  or "ASTRA Bocconi". Pick one before the listing.
