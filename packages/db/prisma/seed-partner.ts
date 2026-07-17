// Seeds a demo partner venue + login account: "Casa di Michele".
// Login code: casadimichele  ·  password: 123456789  (issued by ASTRA).
// Idempotent — safe to re-run. Run: npx tsx prisma/seed-partner.ts (from packages/db)

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(fileURLToPath(new URL("../../../apps/web/.env", import.meta.url)));

const pooledUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg(pooledUrl!) });

// Must match verifyPassword() in apps/web/lib/partner.ts (scrypt, salt:hash).
function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const partner = await prisma.partner.upsert({
    where: { id: "casadimichele" },
    update: { name: "Casa di Michele", active: true },
    create: { id: "casadimichele", name: "Casa di Michele", category: "Restaurant", active: true },
  });

  const email = "casadimichele@partner.astra";
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "Casa di Michele", roles: [Role.PARTNER_MANAGER], emailVerified: true },
    create: { email, name: "Casa di Michele", roles: [Role.PARTNER_MANAGER], emailVerified: true },
  });

  await prisma.partnerMembership.upsert({
    where: { userId: user.id },
    update: {
      partnerId: partner.id,
      loginCode: "casadimichele",
      passwordHash: hashPassword("123456789"),
    },
    create: {
      userId: user.id,
      partnerId: partner.id,
      loginCode: "casadimichele",
      passwordHash: hashPassword("123456789"),
    },
  });

  console.log("✓ Seeded partner: code=casadimichele password=123456789 -> Casa di Michele");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
