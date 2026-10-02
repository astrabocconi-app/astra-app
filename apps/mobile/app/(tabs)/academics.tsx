import type { ComponentProps } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Icon } from "../../components/Icon";
import { NavRow } from "../../components/NavRow";
import { api } from "../../lib/api";
import { useT, type TranslationKey } from "../../lib/i18n";

// New academic tools (the calculators are next) go in this list.
const SECTIONS: { href: Href; icon: ComponentProps<typeof NavRow>["icon"]; title: TranslationKey; sub: TranslationKey }[] = [
  { href: "/materials", icon: "menu-book", title: "academics.materials", sub: "academics.materialsSub" },
  { href: "/guides", icon: "auto-stories", title: "academics.guides", sub: "academics.guidesSub" },
  { href: "/calculator", icon: "calculate", title: "academics.calculator", sub: "academics.calculatorSub" },
  { href: "/master-admissions", icon: "school", title: "academics.masters", sub: "academics.mastersSub" },
];

export default function AcademicsScreen() {
  const t = useT();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me(), retry: false });
  const academic = me.data?.academicProfile ?? null;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-astra-primary" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* Nothing until `me` answers, so the "add your programme" row never
          flashes for a student who already has one. */}
      {me.isLoading ? null : academic ? (
        <Pressable
          onPress={() => router.push("/profile")}
          className="rounded-2xl bg-astra-primary dark:bg-white/10 p-5 active:opacity-90"
        >
          <View className="flex-row items-start justify-between">
            <Text className="text-xl font-semibold text-white">
              {academic.programme.code}
            </Text>
            <Icon name="create-outline" size={18} color="rgba(255,255,255,0.7)" />
          </View>
          <Text className="mt-1 text-[15px] leading-5 text-white/85" numberOfLines={2}>
            {academic.programme.name}
          </Text>
          <Text className="mt-3 text-xs text-white/70">
            {[
              `${t("profile.year")} ${academic.studyYear}`,
              academic.classGroup ? `${t("profile.class")} ${academic.classGroup.code}` : null,
              academic.track?.code,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
        </Pressable>
      ) : (
        <NavRow
          icon="school"
          title={t("academics.noProfile")}
          subtitle={t("academics.noProfileSub")}
          onPress={() => router.push("/profile")}
        />
      )}

      {/* Each resource is its own row, like the rest of the app. */}
      <View className="mt-5 gap-3">
        {SECTIONS.map((s) => (
          <NavRow key={s.title} icon={s.icon} title={t(s.title)} subtitle={t(s.sub)} onPress={() => router.push(s.href)} />
        ))}
      </View>
    </ScrollView>
  );
}
