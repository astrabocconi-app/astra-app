// ASTRAWORLD palette, taken from the announcement poster.
//
// Deliberately kept out of the Tailwind theme: these colours belong to one
// event, not to the brand, and the whole thing comes back out after
// 4 September 2026. Keeping them in one file means the revert is a file
// deletion rather than an archaeology exercise in tailwind.config.js.
//
// FILLS vs INK. The poster colours are built for big flat shapes on coloured
// stock, and several of them are unreadable as small text on white — measured
// against white: yellow 1.43:1, green 1.94:1, magenta 3.97:1. Only the first
// group may be used for shapes, bars, dots and badge backgrounds; anything that
// is actually *text* on a light background uses the `*Ink` variants below, which
// all clear 5:1. Using a fill colour for a label is the mistake this split
// exists to prevent.
export const AW = {
  /** The poster's deep blue — the same family as astra-primary. 15.2:1 on white. */
  navy: "#04107E",
  magenta: "#F0159B",
  green: "#3ED626",
  yellow: "#FFD400",
  /** Dark enough to double as text. 7.9:1 on white. */
  red: "#A3141B",

  // Text-safe counterparts, for labels on white/light surfaces.
  magentaInk: "#B80E76", // 6.3:1
  greenInk: "#1B7A0F", // 5.5:1
  goldInk: "#8A6A00", // 5.1:1
} as const;
