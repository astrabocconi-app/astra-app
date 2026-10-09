// Revoking Eventbrite discounts, and remembering the ones we could not. SERVER-ONLY.
//
// A coded discount lives on Eventbrite, not in our database, so deleting our row
// does not make it stop working. Wherever we drop one (account deletion, a
// reward or event being removed, unused codes being cleared) the id goes through
// here: revoke now, best-effort and time-boxed, and if Eventbrite is down or
// slow park the id in EventbriteRevocation for the daily cron to retry. Nothing
// that reaches this function is ever silently forgotten.

import { prisma } from "@astra/db";
import { deleteDiscount, isEventbriteConfigured } from "./eventbrite";

/** How many revocations run side by side. Well inside Eventbrite's rate limit. */
const CONCURRENCY = 4;

/** Queue ids for the cron, then try them once right away. Returns how many were revoked now. */
export async function revokeDiscounts(discountIds: string[]): Promise<{ revoked: number; pending: number }> {
  const ids = [...new Set(discountIds.filter(Boolean))];
  if (ids.length === 0) return { revoked: 0, pending: 0 };
  // Queue first: if the process dies mid-way the cron still knows about every id.
  await prisma.eventbriteRevocation.createMany({
    data: ids.map((discountId) => ({ discountId })),
    skipDuplicates: true,
  });
  return drainRevocations(ids);
}

/**
 * Try to revoke the given ids (or the oldest queued ones). A revoked id leaves
 * the queue; a failed one has its attempt count bumped and stays for next time.
 */
export async function drainRevocations(only?: string[], limit = 50): Promise<{ revoked: number; pending: number }> {
  const rows = await prisma.eventbriteRevocation.findMany({
    where: only ? { discountId: { in: only } } : {},
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (rows.length === 0) return { revoked: 0, pending: 0 };

  if (!isEventbriteConfigured()) {
    return { revoked: 0, pending: rows.length };
  }

  let revoked = 0;
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const row = queue.shift();
        if (!row) return;
        const ok = await deleteDiscount(row.discountId);
        if (ok) {
          revoked += 1;
          await prisma.eventbriteRevocation.deleteMany({ where: { id: row.id } });
        } else {
          await prisma.eventbriteRevocation.updateMany({
            where: { id: row.id },
            data: { attempts: { increment: 1 }, lastError: "Eventbrite did not confirm the revocation." },
          });
        }
      }
    }),
  );
  return { revoked, pending: rows.length - revoked };
}
