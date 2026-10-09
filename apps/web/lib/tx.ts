// Serializable-transaction helpers. SERVER-ONLY.

import { prisma, Prisma } from "@astra/db";

/**
 * Serializable transactions legitimately abort when two of them touch the same
 * rows — Postgres reports a write conflict and expects the caller to retry.
 */
export function isWriteConflict(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2034" || e.code === "P2028")
  );
}

/**
 * Run `fn` in a Serializable transaction, retrying a few times with jitter when
 * Postgres aborts it for a write conflict. Without the retry, two admins (or a
 * student double-tapping) racing on the same rows got an opaque 500 even though
 * the data was fine.
 */
export async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      if (!isWriteConflict(e) || attempt >= maxAttempts) throw e;
      await new Promise((r) => setTimeout(r, attempt * 25 + Math.floor(Math.random() * 25)));
    }
  }
}
