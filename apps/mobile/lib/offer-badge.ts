import type { PartnerOffer } from "@astra/shared";

/**
 * The small badge next to an offer ("20% off"), or null when it would only
 * repeat the title. Offers are usually written "10% off X", so the badge, the
 * title and the details used to say "10%" three times in a row.
 */
export function offerBadge(o: Pick<PartnerOffer, "label" | "title" | "discountType" | "discountValue">): string | null {
  const title = o.title.toLowerCase().replace(/\s+/g, "");
  const v = o.discountValue;
  switch (o.discountType) {
    case "PERCENT":
      return v != null && !has(title, `${v}%`) ? o.label : null;
    case "FIXED": {
      if (v == null) return null;
      const euros = v % 100 === 0 ? String(v / 100) : (v / 100).toFixed(2);
      const comma = euros.replace(".", ",");
      return [`€${euros}`, `€${comma}`].some((s) => has(title, s, true)) || [`${euros}€`, `${comma}€`].some((s) => has(title, s))
        ? null
        : o.label;
    }
    case "FREEBIE":
      return /free|gratis|omaggio/.test(title) ? null : o.label;
    default:
      // OTHER: the label IS the title.
      return null;
  }
}

/**
 * `needle` in `hay` as a whole number: "5%" is not in "15%", and (with
 * `digitsAfter` checked) "€5" is not in "€50".
 */
function has(hay: string, needle: string, digitsAfter = false): boolean {
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (/\d/.test(hay[i - 1] ?? "")) continue; // "15%" is not "5%"
    const rest = hay.slice(i + needle.length);
    if (digitsAfter && /^[.,]?\d/.test(rest)) continue; // "€50" / "€5.50" is not "€5"
    return true;
  }
  return false;
}
