import { useEffect, useState, type ComponentProps } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Text } from "../../components/AppText";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import * as SecureStore from "expo-secure-store";
import type { AcademicProfile } from "@astra/shared";
import { Icon, Spinner } from "../../components/Icon";
import { NavRow } from "../../components/NavRow";
import { EmptyState } from "../../components/EmptyState";
import { api } from "../../lib/api";
import { useT, type TranslationKey } from "../../lib/i18n";
import { academicYearId, profileNeedsYearCheck } from "../../lib/academic-year";
import { errorCode } from "../../lib/api-errors";
import { alertAfterModal } from "../../lib/alert";
import { announce } from "../../lib/use-reduced-motion";

// New academic tools (the calculators are next) go in this list.
const SECTIONS: { href: Href; icon: ComponentProps<typeof NavRow>["icon"]; title: TranslationKey; sub: TranslationKey }[] = [
  { href: "/materials", icon: "menu-book", title: "academics.materials", sub: "academics.materialsSub" },
  { href: "/guides", icon: "auto-stories", title: "academics.guides", sub: "academics.guidesSub" },
  { href: "/calculator", icon: "calculate", title: "academics.calculator", sub: "academics.calculatorSub" },
  { href: "/master-admissions", icon: "school", title: "academics.masters", sub: "academics.mastersSub" },
];

/** Remembers, per academic year, that the student waved the "still in year N?" card away. */
const YEAR_PROMPT_KEY = "astra_year_prompt";

/**
 * A new academic year starts every September. A programme selection last saved
 * before that is probably a year behind, which quietly gives the wrong handouts
 * and exam list. Ask once, and let it be dismissed.
 */
function YearCheck({ academic }: { academic: AcademicProfile }) {
  const t = useT();
  const qc = useQueryClient();
  const [dismissedFor, setDismissedFor] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync(YEAR_PROMPT_KEY)
      .then(setDismissedFor)
      .catch(() => setDismissedFor(null));
  }, []);

  const now = new Date();
  // Unknown until the stored answer arrives, so it never flashes for someone who dismissed it.
  if (dismissedFor === undefined) return null;
  if (!profileNeedsYearCheck(academic.updatedAt, now) || dismissedFor === academicYearId(now)) return null;

  const year = academic.studyYear;
  const canMoveUp = year < academic.programme.durationYears;

  function dismiss() {
    const id = academicYearId(new Date());
    setDismissedFor(id);
    void SecureStore.setItemAsync(YEAR_PROMPT_KEY, id).catch(() => {});
  }

  /** Re-save the selection for `studyYear`: confirming bumps its date, moving up changes the year. */
  async function save(studyYear: number) {
    setBusy(true);
    try {
      await api.academic.updateProfile({
        programmeId: academic.programme.id,
        studyYear,
        trackId: academic.track?.id ?? null,
        classGroupId: academic.classGroup?.id ?? null,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["me"] }),
        qc.invalidateQueries({ queryKey: ["materials"] }),
      ]);
      announce(t("profile.saved"));
    } catch (e) {
      if (errorCode(e) === "TRACK_REQUIRED") {
        // The new year opens a track: the profile screen asks which.
        router.push("/profile");
      } else {
        alertAfterModal(t("profile.saveFailedTitle"), t("profile.saveFailedBody"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      className="mb-5 rounded-2xl border border-astra-primary/20 dark:border-white/20 bg-astra-light dark:bg-white/10 p-4"
      accessibilityRole="summary"
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text accessibilityRole="header" className="flex-1 text-base font-semibold text-astra-primary dark:text-white">
          {t("academics.yearPromptTitle", { n: String(year) })}
        </Text>
        <Pressable
          onPress={dismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.dismiss")}
          className="h-8 w-8 items-center justify-center"
        >
          <Icon name="close" size={18} color="#04107E" />
        </Pressable>
      </View>
      <Text className="mt-1 text-sm text-gray-700 dark:text-gray-200">{t("academics.yearPromptBody")}</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          disabled={busy}
          onPress={() => save(year)}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl bg-astra-primary dark:bg-white px-4 py-2.5 active:opacity-90"
        >
          {busy ? <Spinner color="#fff" /> : null}
          <Text chrome className="text-sm font-semibold text-white dark:text-astra-primary">
            {t("academics.yearPromptYes", { n: String(year) })}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => (canMoveUp ? save(year + 1) : router.push("/profile"))}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          className="min-h-[44px] items-center justify-center rounded-xl border border-astra-primary/30 dark:border-white/30 px-4 py-2.5 active:opacity-70"
        >
          <Text chrome className="text-sm font-semibold text-astra-primary dark:text-white">
            {canMoveUp ? t("academics.yearPromptNext", { n: String(year + 1) }) : t("academics.yearPromptChange")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AcademicsScreen() {
  const t = useT();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const academic = me.data?.academicProfile ?? null;
  // "Could not load" is not "no programme": offline must not invite them to add one.
  const failed = me.isError && !me.data;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-astra-primary" contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}>
      {/* Nothing until `me` answers, so the "add your programme" row never
          flashes for a student who already has one. */}
      {failed ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => me.refetch() }}
        />
      ) : (
        <>
          {me.isLoading ? null : academic ? (
            <>
              <YearCheck academic={academic} />
              <Pressable
                onPress={() => router.push("/profile")}
                accessibilityRole="button"
                className="rounded-2xl bg-astra-primary dark:bg-white/10 p-5 active:opacity-90"
              >
                <View className="flex-row items-start justify-between">
                  <Text className="text-xl font-semibold text-white">
                    {academic.programme.code}
                  </Text>
                  <Icon name="create-outline" size={18} color="rgba(255,255,255,0.85)" />
                </View>
                <Text className="mt-1 text-[15px] leading-5 text-white/90" numberOfLines={3}>
                  {academic.programme.name}
                </Text>
                <Text className="mt-3 text-xs text-white/80">
                  {[
                    `${t("profile.year")} ${academic.studyYear}`,
                    academic.classGroup ? `${t("profile.class")} ${academic.classGroup.code}` : null,
                    academic.track?.code,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              </Pressable>
            </>
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
        </>
      )}
    </ScrollView>
  );
}
