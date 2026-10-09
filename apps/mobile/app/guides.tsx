import { useMemo, useState, type ComponentProps } from "react";
import { View, Pressable, ScrollView, Linking, Alert } from "react-native";
import { Text } from "../components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { MaterialIcons } from "@expo/vector-icons";
import { Icon, MIcon, Spinner } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { Chip } from "../components/Chip";
import { api } from "../lib/api";
import { useT, type TranslationKey } from "../lib/i18n";

type Lang = "all" | "it" | "en";
const FLAG = { it: "🇮🇹", en: "🇬🇧" } as const;

// Categories a student looks for first come first; anything new the website
// adds lands at the end, so it still shows up without an app release.
const ORDER = [
  "university",
  "opzionali",
  "stage",
  "tesi",
  "exchange_triennale",
  "exchange_magistrale",
  "freemover",
  "graduate",
  "master_admissions",
  "program_change",
  "bgl_domestic_track",
  "ecdl",
  "linkedin",
  "spring weeks",
  "funding",
  "residenze",
  "milan",
  "burocrazia",
  "associations",
];
const ICONS: Record<string, ComponentProps<typeof MaterialIcons>["name"]> = {
  university: "account-balance",
  opzionali: "playlist-add-check",
  stage: "work-outline",
  tesi: "school",
  exchange_triennale: "flight-takeoff",
  exchange_magistrale: "flight-takeoff",
  freemover: "public",
  graduate: "workspace-premium",
  master_admissions: "how-to-reg",
  program_change: "swap-horiz",
  bgl_domestic_track: "gavel",
  ecdl: "computer",
  linkedin: "badge",
  "spring weeks": "event-available",
  funding: "savings",
  residenze: "apartment",
  milan: "location-city",
  burocrazia: "description",
  associations: "groups",
};

export default function GuidesScreen() {
  const t = useT();
  const [lang, setLang] = useState<Lang>("all");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["guides"], queryFn: () => api.guides.list(), staleTime: 10 * 60_000 });

  const label = (category: string) => {
    const key = `guides.cat.${category}` as TranslationKey;
    const value = t(key);
    // Unknown category: show it as the website stores it, tidied.
    return value === key ? category.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : value;
  };

  const categories = useMemo(() => {
    const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
    return (q.data?.categories ?? [])
      .map((c) => ({ ...c, items: c.items.filter((g) => lang === "all" || g.language === lang) }))
      .filter((c) => c.items.length > 0)
      .sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
  }, [q.data, lang]);

  const chip = (value: Lang, text: string) => (
    <Chip key={value} label={text} active={lang === value} onPress={() => setLang(value)} />
  );

  // Guides are third-party pages: a dead link gets a message, not an unhandled rejection.
  function openGuide(url: string) {
    Linking.openURL(url).catch(() => Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody")));
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("guides.title")} subtitle={t("guides.subtitle")} />

      <View className="flex-row flex-wrap gap-2 px-4 pb-1 pt-3" accessibilityRole="radiogroup">
        {chip("all", t("guides.all"))}
        {chip("it", `${FLAG.it}  ${t("guides.italian")}`)}
        {chip("en", `${FLAG.en}  ${t("guides.english")}`)}
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : q.isError && !q.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("guides.loadError")}
          action={{ label: t("common.retry"), onPress: () => q.refetch() }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          {categories.length === 0 && <EmptyState icon="book-outline" title={t("guides.empty")} />}
          {categories.map((c) => {
            const expanded = open === c.category;
            return (
              <View key={c.category} className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
                <Pressable
                  onPress={() => setOpen(expanded ? null : c.category)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  className="min-h-[56px] flex-row items-center gap-3 p-4 active:bg-gray-50 dark:active:bg-white/5"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
                    <MIcon name={ICONS[c.category] ?? "menu-book"} size={20} color="#04107E" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">{label(c.category)}</Text>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                      {c.items.length === 1 ? t("guides.countOne") : t("guides.count", { n: String(c.items.length) })}
                    </Text>
                  </View>
                  <Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#6B7280" />
                </Pressable>
                {expanded &&
                  c.items.map((g) => (
                    <Pressable
                      key={g.id}
                      onPress={() => openGuide(g.url)}
                      accessibilityRole="link"
                      accessibilityLabel={`${g.title}, ${g.language === "it" ? t("guides.italian") : t("guides.english")}`}
                      className="min-h-[52px] flex-row items-center gap-3 border-t border-gray-100 dark:border-white/10 px-4 py-3 active:bg-gray-50 dark:active:bg-white/5"
                    >
                      <Text className="text-lg">{FLAG[g.language]}</Text>
                      <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-white" numberOfLines={2}>
                        {g.title}
                      </Text>
                      <Icon name="open-outline" size={16} color="#04107E" />
                    </Pressable>
                  ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
