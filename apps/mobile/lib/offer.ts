import * as WebBrowser from "expo-web-browser";
import type { PartnerOffer, VenueInteractionInput } from "@astra/shared";
export { offerBadge } from "./offer-badge";
import { api } from "./api";

/** Count a venue interaction for the backoffice. Fire and forget: never blocks or fails the UI. */
export function trackVenue(body: VenueInteractionInput) {
  void api.partners.interaction(body).catch(() => {});
}

/** Open an offer's link (e.g. a Stripe checkout) in an in-app browser sheet. */
export async function openOfferLink(partnerId: string, o: Pick<PartnerOffer, "id" | "linkUrl">): Promise<boolean> {
  if (!o.linkUrl || !o.linkUrl.startsWith("https://")) return false;
  trackVenue({ partnerId, offerId: o.id, kind: "LINK" });
  try {
    await WebBrowser.openBrowserAsync(o.linkUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: "#04107E",
    });
    return true;
  } catch {
    return false;
  }
}
