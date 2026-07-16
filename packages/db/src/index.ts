// Neon/Prisma client singleton (Prisma 7 + pg driver adapter).
//
// SERVER-ONLY. Reads DATABASE_URL (Neon POOLED `-pooler` host) and must never
// be imported from client-side React code or from the mobile app.
// See docs/ARCHITECTURE.md.
//
// Requires the generated client: run `npm run db:generate` after install.
// Env is provided by the host (Next.js loads apps/web/.env automatically;
// scripts load it explicitly).

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot create the Prisma client.");
  }
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
