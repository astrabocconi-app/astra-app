import { useWindowDimensions } from "react-native";

/** Widest the app lays itself out. Phones are narrower; tablets and unfolded foldables get a centred column. */
export const MAX_CONTENT_WIDTH = 600;

/** The width screens should size against (cards, carousels), capped for big displays. */
export function useContentWidth(): number {
  return Math.min(useWindowDimensions().width, MAX_CONTENT_WIDTH);
}
