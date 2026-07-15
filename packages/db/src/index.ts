// Neon/Prisma client singleton.
//
// SERVER-ONLY. This module reads DATABASE_URL and must never be imported from
// client-side React code or from the mobile app. See docs/ARCHITECTURE.md.
//
// TODO(scaffold): uncomment once `prisma generate` has produced the client
// (i.e. once the schema in prisma/schema.prisma has real models).

// import { PrismaClient } from "@prisma/client";
//
// const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
//
// export const prisma =
//   globalForPrisma.prisma ?? new PrismaClient();
//
// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export {};
