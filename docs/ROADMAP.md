# ASTRA - Roadmap

Where the product stands and what is left. Older phase-by-phase history lives in
git (`git log -- docs/ROADMAP.md`); this page is the current picture.

**Legend:** `[x]` done · `[~]` partial · `[ ]` todo · 🙋 owner action in a console
or store · 🤖 code/config work.

## Shipped (iOS on TestFlight, backoffice and API in production)

- [x] Email-OTP sign-in restricted to `@studbocconi.it` / `@unibocconi.it`, Bearer
      sessions (365 days), in-app account deletion, App Review demo account.
- [x] Onboarding: names, generated avatars, programme / year / track (academic profile).
- [x] Loyalty card (signed QR token), points ledger (append-only), partner scanner.
- [x] Discounts: Mapbox map, partner venues, venue detail, offers (QR or informal).
- [x] Rewards: catalogue, redemption, voucher codes (pools, Eventbrite import).
- [x] Events with in-app **Eventbrite discounts** (per-event codes, ticket link in a browser sheet).
- [x] News with push notifications; push campaigns from the backoffice.
- [x] **Academics:** course guides and handouts, materials, free classrooms,
      **grade calculators** (on-device) and the **master-admissions** calculator.
      The gradebook was removed.
- [x] In-app support inbox, bilingual (Italian / English) UI.
- [x] Backoffice: events, news, partners and partner logins, rewards and codes, points,
      push, users, staff, support, audit log; single environment admin with an
      e-mailed second factor.
- [x] Email delivery through Aruba SMTP with a second-mailbox failover.
- [x] Web CI (GitHub Actions: typecheck, lint, tests).

## Before the App Store release

- [ ] 🙋 Separate **dev/preview database** (Neon branch) and separate auth secrets for
      Preview/Development (SETUP.md). Highest-priority risk today.
- [ ] 🙋 Confirm Neon backup window / plan, run one restore drill, disable the unused Neon Auth service.
- [ ] 🙋 Optional: move Vercel and EAS to association-owned accounts; keep
      `app.astrabocconi.com` attached and `astra-app-cyan.vercel.app` as an alias.
- [ ] 🙋 Verify EAS environment variables (`EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_MAPBOX_TOKEN`)
      and add `SENTRY_AUTH_TOKEN` for source maps.
- [ ] 🤖 Install `expo-updates` and run the SDK alignment (`npx expo install --fix`), then
      ship one store build that contains both (DEPLOY.md, OTA section).
- [ ] 🤖 Privacy policy update and in-app link (Sentry, Expo push, Eventbrite, DiceBear or local avatars, support messages, retention).
- [ ] 🙋 App Store Connect: App Privacy answers, screenshots, listing, review notes.

## Later

- [ ] Android: `google-services.json` for push, adaptive icon, tablet and keyboard testing on API 34-36, Play listing.
- [ ] Server-side error tracking for the web app (Sentry for Next.js or a log drain).
- [ ] More tests for the risky server paths (authorization, points ledger, deletion).
- [ ] Drop dead schema (unused tables) after confirming nothing reads them.
- [ ] Decide the future of "Ask ASTRA": the backend exists (`/api/chat`, off by default), the app has no screen.

## Notes

- Every DB access routes through `apps/web/lib/authz.ts`, and mutations in the
  backoffice write an audit entry.
- Calendar time is dominated by external waits (App Review), not build time.
