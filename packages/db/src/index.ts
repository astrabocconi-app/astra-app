// Neon/Prisma client singleton.
//
// SERVER-ONLY. This module reads DATABASE_URL and must never be imported from
// client-side React code or from the mobile app. See docs/ARCHITECTURE.md.
//
// Requires the generated client: run `npm run db:generate` (or any `db:migrate`)
// after installing, once the schema has models.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
