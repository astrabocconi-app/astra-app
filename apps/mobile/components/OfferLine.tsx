import { View } from "react-native";
import type { PartnerOffer } from "@astra/shared";
import { Text } from "./AppText";
import { offerBadge } from "../lib/offer-badge";

/**
 * One discount as a line: a short badge ("20% off") when it adds something the
 * title doesn't already say, then the title. The badge never shrinks and the
 * title wraps under itself, so long offers can't squash or cut either.
 */
export function OfferLine({ offer, lines = 2, strong = false }: { offer: PartnerOffer; lines?: number; strong?: boolean }) {
  const badge = offerBadge(offer);
  return (
    <View className="flex-row items-start gap-2">
      {badge ? (
        <View className="mt-px shrink-0 rounded-full bg-astra-light dark:bg-white/10 px-2 py-0.5">
          <Text maxFontSizeMultiplier={1.3} className="text-[11px] font-semibold text-astra-primary dark:text-white" numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : (
        <View className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-astra-primary/60 dark:bg-white/60" />
      )}
      <Text
        className={`flex-1 text-[14px] leading-5 ${strong ? "font-semibold text-gray-900 dark:text-white" : "text-gray-800 dark:text-gray-100"}`}
        numberOfLines={lines}
      >
        {offer.title}
      </Text>
    </View>
  );
}
