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

/** Pooled connection string, from our name or Vercel's Neon-integration names
 *  (including the STORAGE_ prefix Vercel applies when connecting the store). */
function pooledConnectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_PRISMA_URL ||
    process.env.STORAGE_POSTGRES_URL;
  if (!url) {
    throw new Error("No pooled database URL set (DATABASE_URL / STORAGE_DATABASE_URL / …).");
  }
  return url;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg(pooledConnectionString());
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

// Lazy proxy: the client (and thus the DB URL requirement) is resolved on first
// property access — i.e. at runtime on a real query, never at import/build time.
// This lets `next build` succeed without DB env vars present.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export * from "@prisma/client";
