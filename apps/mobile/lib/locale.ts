// First-run language choice (no imports, so node:test can load it).

export type Language = "en" | "it";

/** A stored choice wins; otherwise Italian phones get Italian and everything else English. */
export function pickLanguage(stored: string | null | undefined, deviceLocale: string | null | undefined): Language {
  if (stored === "it" || stored === "en") return stored;
  return /^it([-_]|$)/i.test(deviceLocale ?? "") ? "it" : "en";
}
