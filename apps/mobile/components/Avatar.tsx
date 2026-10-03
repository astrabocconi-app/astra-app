import { Image, View } from "react-native";
import { avatarUrl } from "@astra/shared";

/** The student's DiceBear avatar in a round light-blue tile. */
export function Avatar({ seed, size }: { seed: string | undefined; size: number }) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-astra-light dark:bg-white/10"
      style={{ width: size, height: size }}
    >
      {seed ? (
        <Image
          source={{ uri: avatarUrl(seed, Math.round(size * 2)) }}
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}
