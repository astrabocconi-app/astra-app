import { useLanguageStore, type Language } from "../language-store";
import * as common from "./common";
import * as login from "./login";
import * as profile from "./profile";
import * as home from "./home";
import * as materials from "./materials";
import * as classrooms from "./classrooms";
import * as ask from "./ask";
import * as partnerScan from "./partnerScan";
import * as event from "./event";
import * as partnerHome from "./partnerHome";
import * as card from "./card";
import * as rewards from "./rewards";
import * as discounts from "./discounts";
import * as academics from "./academics";
import * as astraworld from "./astraworld";
import * as events from "./events";
import * as pointsHistory from "./pointsHistory";
import * as partnerProfile from "./partnerProfile";
import * as news from "./news";
import * as tabs from "./tabs";
import * as partnerTabs from "./partnerTabs";

const namespaces = [
  common,
  login,
  profile,
  home,
  materials,
  classrooms,
  ask,
  partnerScan,
  event,
  partnerHome,
  card,
  rewards,
  discounts,
  academics,
  astraworld,
  events,
  pointsHistory,
  partnerProfile,
  news,
  tabs,
  partnerTabs,
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
export function useT() {
  const language = useLanguageStore((s) => s.language);
  return (key: TranslationKey, vars?: Record<string, string>) => translate(key, language, vars);
}
