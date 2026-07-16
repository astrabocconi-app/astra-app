// Prisma seed — minimal, deterministic dev data.
//
// Run with: npm run db:seed   (after db:migrate)
//
// Idempotent: uses upserts on natural keys so re-running won't duplicate.
// This does NOT create an admin for you. After you log in for real (Phase 2),
// promote yourself with, e.g.:
//   UPDATE "User" SET roles = ARRAY['ADMIN']::"Role"[] WHERE email = 'you@studbocconi.it';

import { fileURLToPath } from "node:url";
import { PrismaClient, Role, DiscountType, LedgerSource } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 doesn't auto-load .env; load the web app's env, then build a client.
process.loadEnvFile(fileURLToPath(new URL("../../../apps/web/.env", import.meta.url)));

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Areas ----------------------------------------------------------------
  const areasData = [
    { slug: "general", name: "General" },
    { slug: "events", name: "Events" },
    { slug: "media", name: "Marketing & Media" },
    { slug: "partnerships", name: "Partnerships" },
  ];
  const areas: Record<string, string> = {};
  for (const a of areasData) {
    const area = await prisma.area.upsert({
      where: { slug: a.slug },
      update: { name: a.name },
      create: a,
    });
    areas[a.slug] = area.id;
  }

  // --- A demo student -------------------------------------------------------
  const student = await prisma.user.upsert({
    where: { email: "demo.student@studbocconi.it" },
    update: {},
    create: {
      email: "demo.student@studbocconi.it",
      name: "Demo Student",
      emailVerified: true,
      roles: [Role.STUDENT],
    },
  });

  // Give the demo student a couple of ledger entries (append-only).
  const existingLedger = await prisma.pointsLedgerEntry.count({
    where: { userId: student.id },
  });
  if (existingLedger === 0) {
    await prisma.pointsLedgerEntry.createMany({
      data: [
        {
          userId: student.id,
          delta: 100,
          source: LedgerSource.SIGNUP,
          reason: "Welcome bonus",
        },
        {
          userId: student.id,
          delta: 50,
          source: LedgerSource.EVENT_CHECKIN,
          reason: "Checked in at Orientation",
        },
      ],
    });
  }

  // --- A partner + offer ----------------------------------------------------
  const partner = await prisma.partner.upsert({
    where: { id: "seed-partner-cafe" },
    update: {},
    create: {
      id: "seed-partner-cafe",
      name: "Campus Café",
      description: "Coffee & study spot near campus.",
      category: "Food & Drink",
      areaId: areas.partnerships,
      latitude: 45.4485,
      longitude: 9.1886,
    },
  });
  await prisma.offer.upsert({
    where: { id: "seed-offer-coffee" },
    update: {},
    create: {
      id: "seed-offer-coffee",
      partnerId: partner.id,
      title: "10% off any coffee",
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      pointsAwarded: 5,
    },
  });

  // --- A reward -------------------------------------------------------------
  await prisma.reward.upsert({
    where: { id: "seed-reward-tote" },
    update: {},
    create: {
      id: "seed-reward-tote",
      title: "ASTRA tote bag",
      description: "Limited-edition tote.",
      costPoints: 120,
      stock: 50,
      areaId: areas.general,
    },
  });

  // --- An event -------------------------------------------------------------
  await prisma.event.upsert({
    where: { id: "seed-event-launch" },
    update: {},
    create: {
      id: "seed-event-launch",
      title: "ASTRA Launch Night",
      description: "Kickoff party for the new app.",
      location: "Aula Magna",
      startsAt: new Date("2026-09-15T18:00:00Z"),
      capacity: 200,
      pointsOnCheckin: 50,
      areaId: areas.events,
      published: true,
    },
  });

  // --- A news post ----------------------------------------------------------
  await prisma.newsPost.upsert({
    where: { id: "seed-news-welcome" },
    update: {},
    create: {
      id: "seed-news-welcome",
      title: "Welcome to ASTRA",
      body: "The new ASTRA app is here. Earn points, unlock rewards, and never miss an event.",
      excerpt: "The new ASTRA app is here.",
      areaId: areas.media,
      published: true,
      pinned: true,
      publishedAt: new Date("2026-09-01T09:00:00Z"),
    },
  });

  // eslint-disable-next-line no-console
  console.log("[seed] Done: areas, demo student (+ledger), partner+offer, reward, event, news.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
