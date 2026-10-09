// A student's avatar seed. SERVER-ONLY.
//
// The seed is stored in User.image as "dicebear:<seed>". It used to default to
// the user id, which meant every avatar render sent a stable internal identifier
// to a third party. Now an account without a seed gets a random one the first
// time it is read, persisted so it stays the same.

import crypto from "node:crypto";
import { prisma } from "@astra/db";
import { AVATAR_PREFIX } from "@astra/shared";

/** 12 URL-safe characters, well inside the 40 the seed pattern allows. */
export function newAvatarSeed(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export function seedFromImage(image: string | null | undefined): string | null {
  return image?.startsWith(AVATAR_PREFIX) ? image.slice(AVATAR_PREFIX.length) : null;
}

/**
 * The seed for this user, creating and saving a random one if they have none.
 * The write is conditional, so two requests racing for a brand-new account end
 * up agreeing on whichever seed landed first.
 */
export async function ensureAvatarSeed(userId: string, image: string | null | undefined): Promise<string> {
  const existing = seedFromImage(image);
  if (existing) return existing;

  await prisma.user.updateMany({
    where: { id: userId, OR: [{ image: null }, { NOT: { image: { startsWith: AVATAR_PREFIX } } }] },
    data: { image: `${AVATAR_PREFIX}${newAvatarSeed()}` },
  });
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  // The account vanished between the two statements: any seed will do for a 404-bound response.
  return seedFromImage(row?.image) ?? newAvatarSeed();
}
