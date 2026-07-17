// Prisma 7 config. Connection URLs live here (no longer in schema.prisma).
//
//   - CLI datasource (migrate/introspect) uses the DIRECT (unpooled) URL.
//   - The runtime client uses the POOLED URL via a driver adapter — see src/index.ts.
//
// Env resolution supports BOTH our names (DATABASE_URL / DIRECT_URL) and the
// names Vercel's Neon integration injects (POSTGRES_URL* / *_UNPOOLED), so
// `vercel env pull` "just works". Prisma 7 doesn't auto-load .env, so we load
// the web app's env file first; on Vercel/CI the vars are already in the env.

import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../apps/web/.env", import.meta.url)));
} catch {
  // No local file (e.g. CI / Vercel) — vars come from the environment.
}

// Direct/unpooled connection for migrations & introspection. Supports our names,
// Vercel's Neon names, and the STORAGE_ prefix Vercel adds to the store's vars.
const directUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.STORAGE_DATABASE_URL_UNPOOLED ||
  process.env.STORAGE_POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.STORAGE_POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_POSTGRES_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directUrl,
  },
});
