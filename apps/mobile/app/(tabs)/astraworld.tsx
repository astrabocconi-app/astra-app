import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Image,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { AstraWorldContent, AstraWorldSlot } from "@astra/shared";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { useT, useLanguage } from "../../lib/i18n";
import { AW } from "../../lib/astraworld-theme";
import { BUNDLED_ASTRAWORLD, resolveAstraWorld } from "../../lib/astraworld-content";

/**
 * ASTRAWORLD — the 4 September 2026 festival.
 *
 * TEMPORARY: this tab is the Academics slot, taken over for the run-up to the
 * event and reverting straight afterwards.
 *
 * The copy is editable from the backoffice (AppContent key "astraworld"), so a
 * time or a speaker can be corrected without an App Store update. The bundled
 * copy in lib/astraworld-content.ts is the fallback whenever nothing is stored,
 * the network is down, or a stored row fails validation — the screen must never
 * be blank just because someone mis-saved.
 *
 * The look follows the announcement poster rather than the app's usual
 * restraint, because this screen is a festival flyer, not another list of rows.
 */

/** Matches the ScrollView's own horizontal padding. */
const PAGE_PADDING = 20;
/** A touch taller than the poster's own 2:1. */
const CARD_RATIO = 1.75;

type Lang = "en" | "it";
/** Picks the reader's language, falling back to whichever side was filled in. */
function pick(v: { en: string; it: string }, lang: Lang): string {
  return (lang === "it" ? v.it || v.en : v.en || v.it) ?? "";
}

function Hero({ content, lang }: { content: AstraWorldContent; lang: Lang }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - PAGE_PADDING * 2;
  const cardHeight = Math.round(cardWidth / CARD_RATIO);

  return (
    <View>
      {/* The same rounded card as the news stories on Home, just slightly
          taller, and with no scrim or overlaid title — here the artwork is the
          headline. "contain" over a backdrop sampled from the poster's own edge
          (#FDFDFD) so the letterboxing is invisible. Dimensions are explicit
          numbers: neither aspectRatio nor a percentage width constrains a
          bundled require() asset, which kept its intrinsic 1774px. */}
      <View
        className="overflow-hidden rounded-2xl"
        style={{ width: cardWidth, height: cardHeight, backgroundColor: "#FDFDFD" }}
      >
        <Image
          // Metro resolves bundled image assets through CommonJS.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require("../../assets/astraworld-poster.png")}
          resizeMode="contain"
          accessibilityLabel="ASTRAWORLD, 04 settembre 2026"
          style={{ width: cardWidth, height: cardHeight }}
        />
      </View>

      <View className="mt-4 flex-row items-end gap-3">
        <View className="rounded-2xl px-3.5 py-2" style={{ backgroundColor: AW.magenta }}>
          <Text className="text-[22px] font-black text-white" style={{ letterSpacing: -0.5 }}>
            {content.dateShort}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-extrabold text-gray-900 dark:text-white">
            {pick(content.tagline, lang)}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-white/70">
            {pick(content.date, lang)} · {content.hours}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Fact({ icon, label, tint }: { icon: string; label: string; tint: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-full border border-gray-200 dark:border-white/15 px-3 py-2">
      <Icon name={icon as never} size={14} color={tint} />
      <Text className="text-xs font-semibold text-gray-800 dark:text-white">{label}</Text>
    </View>
  );
}

function SectionTitle({ children, tint }: { children: string; tint: string }) {
  return (
    <View className="mt-7 flex-row items-center gap-2.5">
      <View style={{ width: 5, height: 20, borderRadius: 3, backgroundColor: tint }} />
      <Text className="text-lg font-extrabold text-gray-900 dark:text-white">{children}</Text>
    </View>
  );
}

function Body({ children }: { children: string }) {
  return (
    <Text className="mt-2 text-[14px] leading-[21px] text-gray-600 dark:text-gray-300">
      {children}
    </Text>
  );
}

/** Bottom sheet with a panel's pitch: what it is, and who's on stage. */
function PanelSheet({
  slot,
  lang,
  onClose,
}: {
  slot: AstraWorldSlot | null;
  lang: Lang;
  onClose: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const panel = slot?.panel;

  return (
    <Modal visible={panel != null} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop is a SIBLING behind the sheet, not its parent — nesting it
          made the parent swallow taps meant for the sheet. */}
      <View className="flex-1 justify-end">
        <Pressable style={StyleSheet.absoluteFill} className="bg-black/50" onPress={onClose} />
        {panel && (
          <View
            className="rounded-t-3xl bg-white dark:bg-astra-primary px-6 pt-3"
            style={{ maxHeight: "85%", paddingBottom: insets.bottom + 20 }}
          >
            <View className="mb-3 items-center">
              <View className="h-1 w-10 rounded-full bg-gray-300" />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                className="text-[11px] font-black uppercase tracking-[1.5px]"
                style={{ color: AW.magentaInk }}
              >
                {panel.org}
              </Text>
              <Text className="mt-1 text-[13px] font-bold" style={{ color: AW.greenInk }}>
                {panel.window}
              </Text>

              <Text className="mt-3 text-[21px] font-extrabold leading-7 text-gray-900 dark:text-white">
                {pick(panel.title, lang)}
              </Text>
              <Text className="mt-3 text-[15px] leading-[23px] text-gray-600 dark:text-gray-300">
                {pick(panel.hook, lang)}
              </Text>

              {/* The panels run in Italian regardless of the app's language. */}
              <View className="mt-4 flex-row items-center gap-2 rounded-xl bg-astra-light dark:bg-white/10 px-3 py-2.5">
                <Icon name="language-outline" size={16} color={AW.navy} />
                <Text className="flex-1 text-[12px] font-semibold text-astra-primary dark:text-white">
                  {t("awp.inItalian")}
                </Text>
              </View>

              {panel.speakers.length > 0 && (
                <>
                  <Text className="mt-6 text-[11px] font-black uppercase tracking-[1.5px] text-gray-400 dark:text-white/50">
                    {t("awp.speakers")}
                  </Text>
                  <View className="mt-2 gap-2">
                    {panel.speakers.map((s) => (
                      <View key={s} className="flex-row items-center gap-2.5">
                        <View
                          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: AW.magenta }}
                        />
                        <Text className="flex-1 text-[14px] text-gray-800 dark:text-gray-100">
                          {s}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Pressable
                onPress={onClose}
                className="mt-7 items-center rounded-xl py-3.5 active:opacity-90"
                style={{ backgroundColor: AW.navy }}
              >
                <Text className="text-sm font-bold text-white">{t("awp.close")}</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function AstraWorldScreen() {
  const t = useT();
  const lang = useLanguage() as Lang;
  const insets = useSafeAreaInsets();
  const [openSlot, setOpenSlot] = useState<number | null>(null);

  // The bundled copy is the initial data, so the screen paints immediately and
  // is never blank while the override loads.
  const remote = useQuery({
    queryKey: ["content", "astraworld"],
    queryFn: () => api.content("astraworld"),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const content = remote.data ? resolveAstraWorld(remote.data) : BUNDLED_ASTRAWORLD;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-astra-primary"
      contentContainerStyle={{ padding: PAGE_PADDING, paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Hero content={content} lang={lang} />

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Fact icon="location-outline" label={content.venue} tint={AW.magentaInk} />
        <Fact icon="ticket-outline" label={pick(content.entry, lang)} tint={AW.greenInk} />
        <Fact icon="time-outline" label={content.hours} tint={AW.navy} />
      </View>

      <Pressable
        onPress={() =>
          Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(content.mapsQuery)}`)
        }
        className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl py-3 active:opacity-85"
        style={{ backgroundColor: AW.navy }}
      >
        <Icon name="navigate-outline" size={16} color="#FFFFFF" />
        <Text className="text-sm font-bold text-white">{t("aw.directions")}</Text>
      </Pressable>

      <Body>{pick(content.intro, lang)}</Body>

      {content.dayParagraphs.length > 0 && (
        <>
          <SectionTitle tint={AW.magenta}>{pick(content.dayTitle, lang)}</SectionTitle>
          {content.dayParagraphs.map((p, i) => (
            <Body key={i}>{pick(p, lang)}</Body>
          ))}
        </>
      )}

      {/* Programme */}
      <SectionTitle tint={AW.green}>{pick(content.programmeTitle, lang)}</SectionTitle>
      <Text className="mt-1 text-[12px] text-gray-400 dark:text-white/50">{t("awp.tapHint")}</Text>
      <View className="mt-3">
        {content.slots.map((row, i) => {
          const last = i === content.slots.length - 1;
          const hasPanel = row.panel != null;

          const body = (
            <View className="flex-1 pb-4">
              <Text
                className="text-[13px] font-black"
                style={{ color: row.ours ? AW.magentaInk : AW.navy }}
              >
                {row.time}
              </Text>
              <View className="mt-0.5 flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="text-[14px] text-gray-800 dark:text-gray-100">
                    {pick(row.label, lang)}
                  </Text>
                  {hasPanel && (
                    <Text className="mt-0.5 text-[12px] text-gray-400 dark:text-white/50">
                      {row.panel?.org}
                    </Text>
                  )}
                </View>
                {row.ours && (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: AW.magenta }}>
                    <Text className="text-[10px] font-black text-white">{t("aw.usBadge")}</Text>
                  </View>
                )}
                {hasPanel && <Icon name="chevron-forward" size={16} color={AW.magentaInk} />}
              </View>
            </View>
          );

          return (
            <View key={`${row.time}-${i}`} className="flex-row">
              <View className="items-center" style={{ width: 22 }}>
                <View
                  style={{
                    width: row.ours || hasPanel ? 12 : 8,
                    height: row.ours || hasPanel ? 12 : 8,
                    borderRadius: 6,
                    marginTop: 5,
                    backgroundColor: row.ours ? AW.magenta : hasPanel ? AW.greenInk : AW.navy,
                  }}
                />
                {!last && (
                  <View
                    style={{ flex: 1, width: 2, marginTop: 3, backgroundColor: "rgba(4,16,126,0.15)" }}
                  />
                )}
              </View>

              {hasPanel ? (
                <Pressable
                  className="flex-1 flex-row active:opacity-60"
                  onPress={() => setOpenSlot(i)}
                  accessibilityRole="button"
                >
                  {body}
                </Pressable>
              ) : (
                body
              )}
            </View>
          );
        })}
      </View>
      <Text className="text-[12px] italic text-gray-400 dark:text-white/50">
        {pick(content.programmeNote, lang)}
      </Text>

      <SectionTitle tint={AW.yellow}>{pick(content.villageTitle, lang)}</SectionTitle>
      <Body>{pick(content.villageBody, lang)}</Body>

      <SectionTitle tint={AW.navy}>{pick(content.communitiesTitle, lang)}</SectionTitle>
      <Body>{pick(content.communitiesBody, lang)}</Body>

      <SectionTitle tint={AW.red}>{pick(content.partnersTitle, lang)}</SectionTitle>
      <View className="mt-3 gap-3">
        {content.partnerGroups.map((group, i) => (
          <View key={i}>
            <Text
              className="text-[10px] font-black uppercase tracking-[1.5px]"
              style={{ color: [AW.goldInk, AW.greenInk, AW.magentaInk][i % 3] }}
            >
              {pick(group.label, lang)}
            </Text>
            <View className="mt-1.5 flex-row flex-wrap gap-2">
              {group.names.map((name) => (
                <View
                  key={name}
                  className="rounded-xl border border-gray-200 dark:border-white/15 px-3 py-1.5"
                >
                  <Text className="text-[13px] font-bold text-gray-800 dark:text-white">{name}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">
        {pick(content.partnersNote, lang)}
      </Text>

      <PanelSheet
        slot={openSlot != null ? (content.slots[openSlot] ?? null) : null}
        lang={lang}
        onClose={() => setOpenSlot(null)}
      />
    </ScrollView>
  );
}
