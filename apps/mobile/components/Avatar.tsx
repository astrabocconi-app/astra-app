import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { avatarUrl } from "@astra/shared";
import { API_URL } from "../lib/config";
import { Text } from "./AppText";

/** "Michele Rossi" -> "MR". Two letters at most; a missing name shows nothing. */
function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/**
 * The student's avatar in a round light-blue tile. Their initials show while the
 * picture loads (or if it never does: offline, server down), so the tile still
 * reads as theirs instead of an empty disc.
 */
export function Avatar({
  seed,
  size,
  name,
}: {
  seed: string | undefined;
  size: number;
  name?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // A new seed (picking another avatar) deserves a fresh attempt.
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [seed]);
  const initials = initialsOf(name);

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-astra-light dark:bg-white/10"
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {initials && !loaded ? (
        <Text
          maxFontSizeMultiplier={1}
          className="font-semibold text-astra-primary dark:text-white"
          style={{ fontSize: Math.round(size * 0.36) }}
        >
          {initials}
        </Text>
      ) : null}
      {seed && !failed ? (
        <Image
          source={{ uri: avatarUrl(API_URL, seed, Math.round(size * 2)) }}
          style={{ position: "absolute", width: size, height: size }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          // A photographic-style picture must not be colour-inverted by Smart Invert.
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}
