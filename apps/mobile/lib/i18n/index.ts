import { useLanguageStore, type Language } from "../language-store";
import * as common from "./common";
import * as login from "./login";
import * as profile from "./profile";
import * as home from "./home";
import * as materials from "./materials";
import * as classrooms from "./classrooms";
import * as partnerScan from "./partnerScan";
import * as event from "./event";
import * as partnerHome from "./partnerHome";
import * as card from "./card";
import * as rewards from "./rewards";
import * as discounts from "./discounts";
import * as academics from "./academics";
import * as support from "./support";
import * as links from "./links";
import * as events from "./events";
import * as pointsHistory from "./pointsHistory";
import * as partnerProfile from "./partnerProfile";
import * as news from "./news";
import * as venue from "./venue";
import * as tabs from "./tabs";
import * as partnerTabs from "./partnerTabs";
import * as onboarding from "./onboarding";
import * as polare from "./polare";
import * as guides from "./guides";
import * as calc from "./calc";
import * as masters from "./masters";

const namespaces = [
  common,
  login,
  profile,
  home,
  materials,
  classrooms,
  partnerScan,
  event,
  partnerHome,
  card,
  rewards,
  discounts,
  academics,
  support,
  links,
  events,
  pointsHistory,
  partnerProfile,
  news,
  venue,
  tabs,
  partnerTabs,
  onboarding,
  polare,
  guides,
  calc,
  masters,
];

const en: Record<string, string> = Object.assign({}, ...namespaces.map((n) => n.en));
const it: Record<string, string> = Object.assign({}, ...namespaces.map((n) => n.it));

const dictionaries: Record<Language, Record<string, string>> = { en, it };

export type TranslationKey = keyof typeof en;

export function translate(
  key: TranslationKey,
  language: Language,
  vars?: Record<string, string>,
): string {
  const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, value),
    template,
  );
}

// Reads the current language from the language store, so components using
// this hook automatically re-render when the user flips the switch.
/** The reader current language, for content that carries both side by side. */
export function useLanguage(): Language {
  return useLanguageStore((s) => s.language);
}

/** BCP 47 locale for dates and numbers, so they follow the app language, not the phone's. */
export const useLocale = () => (useLanguage() === "it" ? "it-IT" : "en-GB");

export function useT() {
  const language = useLanguageStore((s) => s.language);
  return (key: TranslationKey, vars?: Record<string, string>) => translate(key, language, vars);
}

/**
 * Like `t`, with a singular form: for n === 1 it uses `<key>One` when that key
 * exists ("1 point", not "1 points"), otherwise the plain key.
 */
export function useTn() {
  const t = useT();
  return (key: TranslationKey, n: number, vars?: Record<string, string>) => {
    const one = `${key}One` as TranslationKey;
    return t(n === 1 && one in en ? one : key, vars);
  };
}
