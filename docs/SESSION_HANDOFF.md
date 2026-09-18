# Session handoff — 2026-09-02 to 2026-09-18

Continuity notes from a Claude Code session, written because the machine it ran
on is being retired. Not a roadmap (see `ROADMAP.md`) — just what happened and
what a fresh session should know before touching this repo again.

## What shipped in this stretch

- **Dashboard sidebar**: sections collapse/expand (`apps/web/app/dashboard/_components/sidebar-nav.tsx`), state in `localStorage`, active section always forced open.
- **Landing page store badges** (`apps/web/app/_ui/store-badges.tsx`): both App Store and Play Store badges are greyed-out/inert with a "Coming next week" / "Coming soon!" note and a curved arrow. The arrow is one path + one SVG `<marker orient="auto">` for the head — the mirrored side is a CSS `scaleX(-1)`, not a hand-mirrored second copy. Don't rebuild this by hand-tuning polygon points again; the marker approach is the fix for that.
- **AstraWorld → Academics revert**: the ASTRAWORLD festival tab was always meant to be temporary (see commit `15f82ea`). It's now fully reverted — mobile tab is back to the greyed-out "Academics — Soon!" placeholder, the AstraWorld dashboard editor/API/schema are deleted, and the two live content items advertising the festival (a News post and an Event, both literally titled "ASTRAWORLD") were soft-deleted. If AstraWorld-shaped code ever reappears in a diff, that's a regression, not a feature.
- **Venue detail screen**: tapping a venue on the Discounts map or list opens `apps/mobile/app/venue/[id].tsx` — photo, logo, description, address/directions, and each offer with a small icon for "redeemed by QR scan" vs. "informal discount". Backoffice (`apps/web/app/dashboard/partners/partner-form.tsx`) got a **Photo** field (separate from the small square **Logo**) and a per-offer **"Redeemed by QR scan"** toggle. New columns: `Partner.photoKey`, `Offer.qrEnabled` (migration `20260914120000_partner_photo_and_offer_qr`).
- **Perf**: the mobile `QueryClient` (`apps/mobile/app/_layout.tsx`) had no default `staleTime`, so switching tabs and back refetched everything from scratch every time — that's what made Home feel slow. Default is now 60s. `points-balance` keeps its own tighter `refetchInterval`; mutations already invalidate their own queries, so nothing went stale.
- **Signorvino venues**: added 5 new venues (Dante, Garibaldi, Rozzano Fiordaliso, Cascina Merlata, City Life), each copying the offers from the original Signorvino. **Address/pin are still blank** — nobody has filled those in yet via the dashboard.
- **Greenmill offer**: still has the placeholder title "Conventional prices". The user wanted the *actual* offer copy in instead but never sent the real text — this is still open, not forgotten.

## Operational gotchas learned the hard way

- **Never run `prisma migrate dev` against this repo.** There's drift on two old migrations (`20260731120000_academic_courses_gradebook`, `20260801100000_gradebook_grade_check_null_safe`) that makes `migrate dev` want to **reset the whole database** (there is only one DB — production — no staging). Always hand-write a new `migrations/<timestamp>_name/migration.sql` folder and apply it with `prisma migrate deploy` instead, from `packages/db`.
- **`vercel --prod` occasionally fails once with `"Not authorized"`** on an otherwise-fine deploy. Just retry — it's worked on the second attempt every time so far.
- **Mobile has no OTA** (`expo-updates` isn't installed). Every change, however small, needs a new native build (`eas build --platform ios --profile production`) and a submission (`eas submit ...`) — there's no instant JS push.
- **App Store Connect "closes" a version once a build under it has been submitted.** A second `eas submit` under the same `version` in `app.config.ts` fails/rejects. Bump the patch version (1.0.0 → 1.0.1 → 1.0.2, one bump per submission round so far) before every new build. `buildNumber` auto-increments on its own (`appVersionSource: "remote"` in `eas.json`); `version` does not — it's a plain string in `apps/mobile/app.config.ts` you have to bump by hand.
- Current mobile state as of this session: **v1.0.2, build 16**, submitted to App Store Connect on 2026-09-14, still only in TestFlight processing — not confirmed reviewed/approved in this session.
- One-off DB scripts (backfills, content fixes) were written as throwaway `.ts` files under `packages/db/prisma/_*.ts`, run with `npx tsx prisma/_whatever.ts` from `packages/db`, and **deleted immediately after running**. That's the established pattern here — don't leave scratch scripts checked in.

## Loose threads for next time

- Signorvino Dante/Garibaldi/Rozzano Fiordaliso/Cascina Merlata/City Life need real addresses + pins.
- Greenmill's offer needs real copy instead of "Conventional prices".
- TestFlight build 16 (v1.0.2) — check it actually processed and, if the user wants it further along, submit for App Store review (separate step from TestFlight upload).
