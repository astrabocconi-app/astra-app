// Partner offer persistence. SERVER-ONLY.
//
// The dashboard edits a partner and its discounts as one form, so a save sends
// the full offer set. Offers that disappear from that set are SOFT-deleted
// (deletedAt + active:false), never hard-deleted: DiscountUsage cascades on
// offer delete, so removing a row would silently destroy redemption history.

import type { Prisma } from "@astra/db";
import type { PartnerOfferInput } from "@astra/shared";

type Tx = Prisma.TransactionClient;

/**
 * Reconcile a partner's offers against the submitted set:
 *   - rows with an `id` are updated (scoped to this partner, so a foreign id
 *     can't be hijacked into someone else's venue)
 *   - rows without an `id` are created
 *   - existing rows absent from the set are soft-deleted
 */
export async function syncPartnerOffers(
  tx: Tx,
  partnerId: string,
  offers: PartnerOfferInput[],
): Promise<void> {
  const keptIds = offers.map((o) => o.id).filter((id): id is string => !!id);

  await tx.offer.updateMany({
    where: { partnerId, deletedAt: null, id: { notIn: keptIds } },
    data: { deletedAt: new Date(), active: false },
  });

  for (const o of offers) {
    const data = {
      title: o.title,
      description: o.description ?? null,
      discountType: o.discountType,
      discountValue: o.discountValue ?? null,
    };
    if (o.id) {
      // updateMany (not update) so the partnerId scope is enforced in SQL.
      await tx.offer.updateMany({
        where: { id: o.id, partnerId },
        data: { ...data, active: true, deletedAt: null },
      });
    } else {
      await tx.offer.create({ data: { ...data, partnerId } });
    }
  }
}
