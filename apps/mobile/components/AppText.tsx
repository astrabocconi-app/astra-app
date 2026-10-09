import { Text as RNText, type TextProps } from "react-native";

/** How far system text scaling may grow body copy, and controls with fixed-size boxes. */
export const BODY_SCALE_CAP = 2;
export const CHROME_SCALE_CAP = 1.4;

/**
 * Drop-in replacement for react-native's Text with a ceiling on Dynamic Type /
 * Android font scale. React 19 ignores Text.defaultProps, so the cap has to live
 * in a component. Body copy may grow to 2x; `chrome` (tab labels, chips,
 * buttons, anything in a fixed-size box) stops at 1.4x so the layout holds.
 * An explicit maxFontSizeMultiplier still wins.
 */
export function Text({
  chrome,
  maxFontSizeMultiplier,
  ...rest
}: TextProps & { chrome?: boolean }) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (chrome ? CHROME_SCALE_CAP : BODY_SCALE_CAP)}
      {...rest}
    />
  );
}
