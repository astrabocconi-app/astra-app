# ASTRA — v1 Build Roadmap

The ordered checklist to take the scaffold to a **complete v1 loyalty platform**
(points, rewards, partners, materials, events+tickets, news, users, audit) across
the Expo app and the Next.js dashboard+API.

**Scope:** full platform, nothing trimmed. Adds a **News** module the scaffold
doesn't yet have; the scannable QR exists in two forms — a **loyalty card** (earn
points at partners) and **event tickets** (RSVP + check-in).

**Stack (locked by ADRs — see ARCHITECTURE.md):** Turborepo · Neon Postgres ·
Prisma · Next.js (dashboard + API) · Better Auth email-OTP (`@studbocconi.it` / `@unibocconi.it`) ·
Cloudflare R2 · Resend · Expo/Expo Router/NativeWind/TanStack Query/Zustand · Zod
at every boundary · Sentry.

**Workflow:** Claude Code builds on `develop`; you review, verify it works, then
promote `develop → main` yourself.

**Legend:** 🤖 = Claude Code does it (you review) · 🙋 = you do by hand
(accounts, secrets, devices, money, approvals, content).

Each phase unblocks the next. Ownership is marked per item.

---

## PART A — Foundation (scope-independent; do first, in order)

### Phase 0 — Accounts & secrets  *(🙋 you; ~30 min, parallelizable)*
- [ ] 🙋 **Neon** `dev` project, pooling on. Copy `DATABASE_URL` (pooled `-pooler`) + `DIRECT_URL`.
- [ ] 🙋 **Resend** account + API key + verified sending domain.
- [ ] 🙋 **Cloudflare R2** bucket + scoped API token *(can defer until Materials/News images)*.
- [ ] 🙋 **Sentry** — one project for web, one for mobile → 2 DSNs.
- [ ] 🙋 **Expo/EAS** — `eas login`, `eas init`, paste `projectId` into `app.config.ts`.
- [ ] 🙋 Secrets: `BETTER_AUTH_SECRET` = `openssl rand -base64 32`; `CARD_TOKEN_HMAC_SECRET` = `openssl rand -hex 32`.
- [ ] 🙋 Fill `apps/web/.env` and `apps/mobile/.env` from the `.env.example` files. 🤖 I'll map each value.
- [ ] 🙋 Start **Apple Developer** ($99/yr) + **Google Play** ($25) enrollment — needed only to ship, but approval lags.

### Phase 1 — Database schema  *(🤖 keystone — everything depends on it)*
- [ ] 🤖 Full Prisma schema: `User`, roles/areas, soft-delete (`deletedAt`), consent (`policyVersion`).
- [ ] 🤖 Append-only `PointsLedgerEntry` (+ no mutable balance anywhere).
- [ ] 🤖 `PointsBalance` SQL view + `MaterialStats` view (raw-SQL migration; aggregate-only for privacy).
- [ ] 🤖 UPDATE/DELETE-revoking trigger on the ledger (raw SQL).
- [ ] 🤖 `DiscountUsage` with generated `usageDate` + `@@unique([userId, offerId, usageDate])`.
- [ ] 🤖 Geo strategy: verify PostGIS on Neon; else `earthdistance`/haversine. Record choice in ARCHITECTURE.md.
- [ ] 🤖 Better Auth Prisma tables. Seed script (fake data + a seeded admin = you).
- [ ] 🙋 `npm run db:migrate` + `npm run db:seed`; verify in `npm run db:studio`.

### Phase 2 — Auth spine  *(🤖)*
- [ ] 🤖 Better Auth email-OTP on web: `/api/auth/otp/send` (validate `@studbocconi.it` + rate-limit 3/min) & `/verify`.
- [ ] 🤖 Implement `lib/authz.ts` for real — deny-by-default; roles + areas.
- [ ] 🤖 `/api/me` returns the real user; `/api/health` verifies Neon (`SELECT 1`).
- [ ] 🤖 Real mobile OTP flow (SecureStore session) + auth header in the shared typed client.
- [ ] 🙋 **Milestone:** log in on your phone with your student email → land on home showing real `/api/me`.

### Phase 3 — Shells → real  *(🤖)*
- [ ] 🙋 Add the **media kit** to `apps/mobile/assets/brand` (logo SVG/PNG, colors, fonts).
- [ ] 🤖 Design tokens from the media kit (NativeWind theme); app icon + splash.
- [ ] 🤖 Mobile bottom-tab navigation (Home/Card, Partners, Rewards, Events, News, Profile).
- [ ] 🤖 Web dashboard: real auth-gated layout; protect all admin routes via `authz`.
- [ ] 🤖 Establish the per-endpoint pattern: Zod parse → `authz.assertCan` → Prisma → audit write.

---

## PART B — Feature modules (dependency-ordered)

### Phase 4 — Points engine  *(🤖 core; rewards/partners/events depend on it)*
- [ ] 🤖 Server service: `earn()` / `spend()` writing ledger entries; balance read via `PointsBalance`.
- [ ] 🤖 `spend()` rejects when balance insufficient (checked in a transaction).
- [ ] 🤖 Endpoints: `GET /api/points/balance`, `GET /api/points/history`.
- [ ] 🤖 Mobile: points balance on Home + ledger history screen.
- [ ] 🙋 Verify earn/spend/balance with seeded data.

### Phase 5 — Loyalty card (scannable QR)  *(🤖 the earn mechanism)*
- [ ] 🤖 HMAC-signed, short-lived rotating card token (`CARD_TOKEN_HMAC_SECRET`).
- [ ] 🤖 Mobile "My Card" screen: renders the rotating QR offline.
- [ ] 🤖 Scan/redeem endpoint (staff/partner) → verify token → `earn()` → ledger + audit.
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

### Phase 8 — Events + tickets + check-in  *(🤖)*
- [ ] 🤖 `Event`, `Rsvp`, `Ticket` models; capacity handling.
- [ ] 🤖 RSVP / get-ticket → issue signed ticket; optional points on check-in.
- [ ] 🤖 Staff **check-in scanner** (expo-camera): valid ✅ / used ⚠️ / invalid ❌; marks used atomically.
- [ ] 🤖 Mobile: events list/detail, "My Tickets" with offline QR.
- [ ] 🤖 Dashboard: event CRUD + live check-in counts.
- [ ] 🙋 Test full loop: get ticket → check in → re-scan shows "already used".

### Phase 9 — News / announcements + push  *(🤖 new module)*
- [ ] 🤖 `NewsPost` model (+ images via R2); dashboard publish/CRUD.
- [ ] 🤖 Mobile: news feed (pull-to-refresh) + detail.
- [ ] 🤖 Expo push: register device tokens; send on publish (Edge/route + Expo push API).
- [ ] 🙋 Approve the notification permission on device; confirm a push arrives on publish.

### Phase 10 — Materials  *(🤖)*
- [ ] 🤖 `Material` model; upload → R2; download via **short-lived signed URLs** (bucket never public).
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

### Phase 13 — Deploy web (dashboard + API)  *(🙋 + 🤖)*
- [ ] 🙋 Neon `staging` + `prod` projects; 🙋 Vercel import, Root Dir `apps/web`, env per environment.
- [ ] 🤖 `db:migrate:deploy` wiring against `DIRECT_URL` (from CI/local, not Vercel build).
- [ ] 🙋 Smoke-test `/api/health` on the deployment; wire per-PR Neon branch previews.

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
