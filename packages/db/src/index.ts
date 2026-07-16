// Neon/Prisma client singleton (Prisma 7 + pg driver adapter).
//
// SERVER-ONLY. Uses the POOLED connection and must never be imported from
// client-side React code or from the mobile app. See docs/ARCHITECTURE.md.
//
// Requires the generated client: run `npm run db:generate` after install.
// Env is provided by the host (Next.js loads apps/web/.env automatically;
// scripts load it explicitly). Supports both our names and Vercel's Neon
// integration names, so `vercel env pull` works without edits.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Pooled connection string, from our name or Vercel's Neon-integration names. */
function pooledConnectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No database URL set (DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL)."
    );
  }
  return url;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg(pooledConnectionString());
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
