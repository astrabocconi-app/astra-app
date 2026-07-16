// Prisma 7 config. Connection URLs live here (no longer in schema.prisma).
//
//   - CLI datasource (migrate/introspect) uses DIRECT_URL (Neon UNPOOLED host).
//   - The runtime client uses DATABASE_URL via a driver adapter — see src/index.ts.
//
// Prisma 7 does not auto-load .env, so we load the web app's env file (the
// single source of DB credentials) before reading it.

import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../apps/web/.env", import.meta.url)));
} catch {
  // Env may already be present in the environment (e.g. CI); ignore if missing.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
