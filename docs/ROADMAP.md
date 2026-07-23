# ASTRA — v1 Build Roadmap

The ordered checklist to take the scaffold to a **complete v1 loyalty platform**
(points, rewards, partners, materials, events, news, users, audit) across
the Expo app and the Next.js dashboard+API.

**Scope:** Adds a **News** module the scaffold doesn't yet have. The scannable QR
is **loyalty-card only** — students show it, partner venues scan it to award
points. **Events are advertise-only** (no in-app tickets/RSVP/check-in): they're
shown in the app and link out to where tickets are actually sold.

**Stack (locked by ADRs — see ARCHITECTURE.md):** Turborepo · Neon Postgres ·
Prisma · Next.js (dashboard + API) · Better Auth email-OTP (`@studbocconi.it` / `@unibocconi.it`) ·
Vercel (hosting + Neon DB / Blob / Resend via Storage & Marketplace) · Expo/Expo Router/NativeWind/TanStack Query/Zustand · Zod
at every boundary · Sentry.

**Workflow:** Claude Code builds on `develop`; you review, verify it works, then
promote `develop → main` yourself.

**Legend:** 🤖 = Claude Code does it (you review) · 🙋 = you do by hand
(accounts, secrets, devices, money, approvals, content).

Each phase unblocks the next. Ownership is marked per item.

**Progress:** Phases 1–4 ✅ done (DB, auth, branded app shell, points engine).
Phase 0 mostly done (Neon, secrets, **email delivery via Aruba SMTP** done;
Blob / Sentry / EAS-build / store enrollment pending). Phase 13 partially done —
**web dashboard + API are deployed and live on Vercel** (ASTRA team) with
`/api/health` green and real OTP email working end-to-end; dedicated
staging/prod Neon + CI migration wiring still TODO.
Recent work: **long-lasting login** (365-day rolling session) landed, plus a
**mobile UI/UX pass** — centered logo header, single-line greeting, full-width
swipeable news carousel, compact event cards (cover-image ready), safe-area tab
bar, QR card with a centered A-logo + offline token caching, a profile
course/year selector (on-device placeholder until the real list + server field),
and a red-outlined sign-out.
**Next up → Phase 5 (loyalty card QR) hardening.** Legend: `[x]` done · `[~]` partial · `[ ]` todo.

---

## PART A — Foundation (scope-independent; do first, in order)

### Phase 0 — Accounts & secrets  *(🙋 you; ~partially done)*
- [x] 🙋 **Neon** `dev` project, pooling on. `DATABASE_URL` (pooled) + `DIRECT_URL` in `apps/web/.env`.
- [x] 🙋 **Email delivery** — OTP codes sent via **Aruba SMTP** (`noreply@astrabocconi.com`); SMTP_* env set on Vercel. *(dev still logs to console; Resend remains a coded fallback.)*
- [ ] 🙋 **Vercel Blob** (Storage → Blob) — auto-injects `BLOB_READ_WRITE_TOKEN` *(deferred until Materials/News images)*.
- [ ] 🙋 **Sentry** — one project for web, one for mobile → 2 DSNs.
- [~] 🙋 **Expo/EAS** — Expo account done; `eas init` + `projectId` in `app.config.ts` still TODO (needed for dev/store builds).
- [x] 🙋 Secrets: `BETTER_AUTH_SECRET` + `CARD_TOKEN_HMAC_SECRET` generated.
- [x] 🙋 `apps/web/.env` + `apps/mobile/.env` created (DB + secrets in; Resend/Blob/Sentry via Vercel pending).
- [ ] 🙋 Start **Apple Developer** ($99/yr) + **Google Play** ($25) enrollment — needed only to ship.

### Phase 1 — Database schema  ✅ DONE  *(🤖 keystone)*
- [x] 🤖 Full Prisma schema: `User`, roles/areas, soft-delete (`deletedAt`), consent (`policyVersion`).
- [x] 🤖 Append-only `PointsLedgerEntry` (+ no mutable balance anywhere).
- [x] 🤖 `PointsBalance` SQL view + `MaterialStats` view (raw-SQL migration; aggregate-only for privacy).
- [x] 🤖 UPDATE/DELETE-revoking trigger on the ledger (raw SQL) — verified live.
- [x] 🤖 `DiscountUsage` with generated `usageDate` (UTC day) + `@@unique([userId, offerId, usageDate])`.
- [ ] 🤖 Geo strategy: verify PostGIS on Neon; else `earthdistance`/haversine. *(deferred to Phase 6)*
- [x] 🤖 Better Auth Prisma tables (Session/Account/Verification). Seed script (areas, demo student, partner, reward, event, news).
- [x] 🙋 Migrated to Neon (`migrate deploy`) + seeded; zero schema drift verified.

### Phase 2 — Auth spine  ✅ DONE  *(🤖)*
- [x] 🤖 Better Auth email-OTP on web (`@studbocconi.it`/`@unibocconi.it` before-hook + rate-limit 3/min); bearer plugin.
- [x] 🤖 Implement `lib/authz.ts` for real — deny-by-default; roles + areas.
- [x] 🤖 `/api/me` returns the real user; `/api/health` verifies Neon (`SELECT 1`).
- [x] 🤖 Real mobile OTP flow (SecureStore session) + Bearer auth header in the shared typed client.
- [x] 🙋 **Milestone:** verified end to end (curl + on the iOS simulator).
- [x] 🤖 **Long-lasting login:** 365-day rolling session (`updateAge` 1 day) in `lib/auth.ts`; the mobile app persists the bearer token in the OS keychain (`apps/mobile/lib/session.ts`), so students sign in once. Applies to the web dashboard cookie too.

### Phase 3 — Shells → real  ✅ DONE  *(🤖)*
- [x] 🙋 Media kit (logos) added to `brand/` + `apps/mobile/assets/`. *(exact brand hexes/fonts optional refinement)*
- [x] 🤖 Design tokens from the logo (brand blue `#04107E` in NativeWind); app icon. *(splash deferred to builds)*
- [x] 🤖 Mobile bottom-tab navigation (Home / Events / Card / Rewards / Profile); campus-backdrop login.
- [x] 🤖 Web dashboard: auth-gated layout (deny-by-default) + `/signin`; admin routes protected.
- [x] 🤖 **Single central admin login** — `/signin` is now username + password + emailed OTP (2FA), fully separate from the student email-OTP flow (`lib/admin-auth.ts`, `adminLoginPlugin` in `lib/auth.ts`, `scripts/create-admin.mjs`). ASTRA controls all content; partners/areas do **not** self-serve.
- [x] 🤖 Established the per-endpoint pattern: session → `authz` → Prisma (+ audit lands with the feature phases).

---

## PART B — Feature modules (dependency-ordered)

### Phase 4 — Points engine  ✅ DONE  *(🤖 core; rewards/partners/events depend on it)*
- [x] 🤖 Server service (`lib/points.ts`): `earn()` / `spend()` writing ledger entries; balance = SUM over the ledger.
- [x] 🤖 `spend()` rejects when balance insufficient (Serializable transaction — no overspend races).
- [x] 🤖 Endpoints: `GET /api/points/balance`, `GET /api/points/history` (auth-gated).
- [x] 🤖 Mobile: points balance on Home (tappable) + points-history screen.
- [x] 🙋 Verified: earn 250 → spend 90 → balance 160; overspend rejected; API returns balance+history.

### Phase 5 — Loyalty card (scannable QR)  *(🤖 the earn mechanism)*
- [~] 🤖 HMAC-signed card token implemented (`lib/card-token.ts`, `CARD_TOKEN_HMAC_SECRET`). **Short-lived rotation + single-use/replay-block still pending** (token currently valid ~24h — a screenshot would still scan).
- [~] 🤖 Mobile "My Card" screen: renders the QR with a **centered A-logo + offline token caching** and "refreshes automatically / works offline" copy (`apps/mobile/app/(tabs)/card.tsx`). True short-lived rotation still pending (see above).
- [~] 🤖 Scan endpoint (staff/partner) → verify token → `earn()` → ledger is **live** (`/api/partner/scan`). **AuditLog write on scan still pending** (Phase 11 invariant).
- [ ] 🙋 Test: show card, scan it from a second device, see points land.

### Phase 6 — Partners & discounts  *(🤖)*
- [ ] 🤖 `Partner` + `Offer` models; dashboard CRUD (area-scoped via authz).
- [ ] 🤖 Redeem flow → `DiscountUsage` (once-per-day unique) (+ optional points).
- [ ] 🤖 "Partners near me": geo query (PostGIS/haversine) + radius.
- [ ] 🤖 Mobile: partner list/map, offer detail, redeem.
- [ ] 🙋 Verify once-per-day constraint blocks a second same-day redemption.

### Phase 7 — Rewards (spend points)  *(🤖)*
- [ ] 🤖 `Reward` catalog + redemption (atomic `spend()`; deny if insufficient).
- [ ] 🤖 Endpoints + dashboard CRUD + fulfillment/redemption states.
- [ ] 🤖 Mobile: rewards catalog, redeem, redemption history.
- [ ] 🙋 Verify a redemption debits points and a too-expensive one is refused.

### Phase 8 — Events (advertise + external ticketing)  *(🤖; scope trimmed)*
**No in-app tickets / RSVP / check-in.** Events are advertised in the app and link
out to wherever tickets are actually sold. (The `Rsvp`/`Ticket` models, the
`EVENT_CHECKIN` points source, and the check-in scanner are **dropped** from v1.)
- [ ] 🤖 `Event` model: title, description, image (Blob), date/time, location, **external ticket URL**.
- [ ] 🤖 Dashboard: event CRUD (publish/unpublish, area-scoped).
- [ ] 🤖 Mobile: events list + detail with a **"Get tickets"** button that opens the external link (wires up the Home "Latest events" placeholder).
- [ ] 🙋 Verify events publish/hide correctly and the external link opens.

### Phase 9 — News / announcements + push  *(🤖 new module)*
- [ ] 🤖 `NewsPost` model (+ images via Vercel Blob); dashboard publish/CRUD.
- [ ] 🤖 Mobile: news feed (pull-to-refresh) + detail.
- [ ] 🤖 Expo push: register device tokens; send on publish (Edge/route + Expo push API).
- [ ] 🙋 Approve the notification permission on device; confirm a push arrives on publish.

### Phase 10 — Materials  *(🤖)*
- [ ] 🤖 `Material` model; upload → **Vercel Blob**; serve via Blob URLs (private/token where needed).
- [ ] 🤖 `MaterialStats` view surfaced to admins — **aggregate counts only, no per-user rows**.
- [ ] 🤖 Mobile: materials list + download; dashboard: upload + stats.
- [ ] 🙋 Confirm signed URLs expire and the bucket isn't publicly listable.

### Phase 11 — Users, roles/areas admin & Audit log  *(🤖)*
- [ ] 🤖 Dashboard user management: list, assign roles/areas, soft-delete, consent view.
- [ ] 🤖 Audit log written on **every** mutating admin action (append-only) + dashboard audit viewer.
- [ ] 🙋 Verify a non-admin is denied and the action is audited.

### Phase 12 — Hardening & polish  *(🤖)*
- [ ] 🤖 Zod on every endpoint (no `any` at the boundary); consistent error envelope + `requestId`.
- [ ] 🤖 Rate limits on sensitive routes; CORS allow-list (`MOBILE_ALLOWED_ORIGINS`).
- [ ] 🤖 Loading/empty/error/offline states across mobile; accessibility pass.
- [ ] 🤖 i18n (IT/EN) if desired. 🙋 decide.
- [ ] 🤖 Tests: authz unit tests, points-ledger invariants, endpoint contract tests. Sentry verified both apps.

---

## PART C — Ship

### Phase 13 — Deploy web (dashboard + API)  *(🙋 + 🤖; ~partially done)*
- [~] 🙋 Vercel import + Root Dir `apps/web` + env done — **production live on the ASTRA-team Vercel** (`astra-app-liard.vercel.app`); dedicated Neon `staging`/`prod` projects still TODO (one Neon for now).
- [~] 🤖 DB migrated to Neon (`migrate deploy` from Phase 1); formal `db:migrate:deploy` CI wiring against `DIRECT_URL` still TODO.
- [~] 🙋 `/api/health` smoke-tested on the live deployment (`db:up` ✅); per-PR Neon branch previews still TODO.

### Phase 14 — Ship mobile  *(🙋 + 🤖)*
- [ ] 🤖 Finalize `app.config.ts` per-env API URLs, `eas.json` profiles, Android **API 36**.
- [ ] 🙋 `eas build --profile preview` (internal APK) → test on real devices.
- [ ] 🤖 Store copy + privacy policy draft; 🙋 screenshots, listings in App Store Connect / Play Console.
- [ ] 🙋 `eas build/submit --profile production`; submit for review; respond to reviewers.

---

## Notes
- **Media kit:** drop into `apps/mobile/assets/brand` (and a `/brand` root folder for raw source). Tokens flow into the NativeWind theme.
- **Every** DB access routes through `lib/authz.ts` and (for mutations) writes an audit entry — this is added per-endpoint as modules land, not bolted on at the end.
- Calendar time is dominated by **external waits** (Apple/Play review, account approvals), not build time.
