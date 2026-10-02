// Which language a guide is written in. Pure, so the test can import it.

export type GuideLanguage = "it" | "en";

// The table has no language column; every guide says it in its title or file
// name instead ("… ITA.pdf", "LinkedIn EN", "Guida …" vs "Guide …"). Explicit
// markers win, then the Italian words the titles actually use; English is the
// default because most guides without a marker are the English edition.
const IT_MARKER = /(^|[^a-z])(ita|it|italiano)([^a-z]|$)/;
const EN_MARKER = /(^|[^a-z])(eng|en|english|ing)([^a-z]|$)/;
const IT_WORDS = /\b(guida|vivere|cambio|agevolazioni|primo anno|corsi|residenze|lavoro|laurea|triennale|magistrale)\b/;

export function guideLanguage(title: string, fileUrl: string): GuideLanguage {
  const file = decodeURIComponent(fileUrl.split("/").pop() ?? "").toLowerCase().replace(/\.pdf.*$/, "");
  const name = title.toLowerCase();
  for (const text of [name, file]) {
    if (IT_MARKER.test(text)) return "it";
    if (EN_MARKER.test(text)) return "en";
  }
  return IT_WORDS.test(name) ? "it" : "en";
}
