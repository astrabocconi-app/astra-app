// Points-history reasons are English sentences the server wrote. The app shows
// them in the student's language by mapping the ledger `source` plus the known
// sentence shapes to a translation key. Unknown text falls through unchanged.
// (No imports, so node:test can load it.)

export type LedgerLabel = { key: string; vars: Record<string, string> };

const SEP = " · ";

export function ledgerLabel(source: string, reason: string): LedgerLabel | null {
  if (source === "SIGNUP") return { key: "points.signup", vars: {} };
  if (source === "EVENT_CHECKIN") return { key: "points.eventCheckin", vars: {} };
  if (source === "PARTNER_SCAN" && reason.startsWith("Scanned at ")) {
    const rest = reason.slice("Scanned at ".length);
    const i = rest.indexOf(SEP);
    return i === -1
      ? { key: "points.scanned", vars: { place: rest } }
      : { key: "points.scannedOffer", vars: { place: rest.slice(0, i), offer: rest.slice(i + SEP.length) } };
  }
  if (source === "REWARD_REDEMPTION" && reason.startsWith("Redeemed: ")) {
    return { key: "points.redeemed", vars: { title: reason.slice("Redeemed: ".length) } };
  }
  if (source === "ADMIN_ADJUSTMENT" && reason.startsWith("Refund: ")) {
    return { key: "points.refund", vars: { title: reason.slice("Refund: ".length) } };
  }
  return null;
}
