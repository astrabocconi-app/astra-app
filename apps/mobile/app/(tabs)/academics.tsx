import { View, Text, Pressable, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { useT, type TranslationKey } from "../../lib/i18n";

// New academic tools go in this list.
const SECTIONS: { href: Href; title: TranslationKey; sub: TranslationKey }[] = [
  { href: "/materials", title: "academics.materials", sub: "academics.materialsSub" },
  { href: "/gradebook", title: "academics.gradebook", sub: "academics.gradebookSub" },
];

export default function AcademicsScreen() {
  const t = useT();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const academic = me.data?.academicProfile ?? null;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-astra-primary" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Pressable
        onPress={() => router.push("/profile")}
        className={`rounded-[18px] p-5 active:opacity-90 ${
          academic ? "bg-astra-primary dark:bg-white/10" : "border-[1.5px] border-dashed border-astra-primary dark:border-white/40"
        }`}
      >
        {academic ? (
          <>
            <View className="flex-row items-start justify-between">
              <Text className="text-[34px] font-extrabold text-white" style={{ letterSpacing: -1 }}>
                {academic.programme.code}
              </Text>
              <Icon name="create-outline" size={18} color="rgba(255,255,255,0.7)" />
            </View>
            <Text className="mt-1 text-[15px] leading-5 text-white/85" numberOfLines={2}>
              {academic.programme.name}
            </Text>
            <Text className="mt-3 text-[12px] font-bold uppercase text-white/60" style={{ letterSpacing: 1.2 }}>
              {[
                `${t("profile.year")} ${academic.studyYear}`,
                academic.classGroup ? `${t("profile.class")} ${academic.classGroup.code}` : null,
                academic.track?.code,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          </>
        ) : (
          <>
            <Text className="text-lg font-bold text-astra-primary dark:text-white">{t("academics.noProfile")}</Text>
            <Text className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-300">{t("academics.noProfileSub")}</Text>
          </>
        )}
      </Pressable>

      <View className="mt-5 overflow-hidden rounded-[18px] border border-gray-200 dark:border-white/15">
        {SECTIONS.map((s, i) => (
          <Pressable
            key={s.title}
            onPress={() => router.push(s.href)}
            className={`flex-row items-center gap-4 px-4 py-4 active:bg-astra-light dark:active:bg-white/10 ${
              i > 0 ? "border-t border-gray-200 dark:border-white/15" : ""
            }`}
          >
            <Text
              className="w-7 text-[13px] font-bold text-astra-primary/40 dark:text-white/40"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {String(i + 1).padStart(2, "0")}
            </Text>
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900 dark:text-white">{t(s.title)}</Text>
              <Text className="text-[13px] text-gray-500 dark:text-gray-300">{t(s.sub)}</Text>
            </View>
            <Icon name="arrow-forward" size={18} color="#04107E" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
