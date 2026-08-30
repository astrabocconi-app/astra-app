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
import { Icon } from "../../components/Icon";
import { useT } from "../../lib/i18n";
import { AW } from "../../lib/astraworld-theme";

/**
 * ASTRAWORLD — the 4 September 2026 festival.
 *
 * TEMPORARY: this tab is the Academics slot, taken over for the run-up to the
 * event and reverting straight afterwards. The old placeholder lives in git
 * (`git log --follow` this path); its strings are still in lib/i18n/academics.ts,
 * untouched, so putting it back is a rename and a tab-config edit.
 *
 * The look follows the announcement poster rather than the app's usual restraint
 * — heavy display type, the poster's magenta/green/yellow on navy — because this
 * screen is a festival flyer, not another list of rows.
 */

/**
 * The four panels, condensed from their run-sheets into something that sells
 * the session at a glance. Times come from the run-sheets themselves, which are
 * more specific than the top-level programme.
 */
interface Panel {
  id: string;
  orgKey: string;
  shortKey: string;
  titleKey: string;
  hookKey: string;
  speakerKeys: string[];
  window: string;
}

const PANELS: Record<string, Panel> = {
  startlab: {
    id: "startlab",
    orgKey: "awp.startlab.org",
    shortKey: "awp.startlab.short",
    titleKey: "awp.startlab.title",
    hookKey: "awp.startlab.hook",
    speakerKeys: ["awp.startlab.s1", "awp.startlab.s2", "awp.startlab.s3"],
    window: "15:00 – 15:50",
  },
  ef: {
    id: "ef",
    orgKey: "awp.ef.org",
    shortKey: "awp.ef.short",
    titleKey: "awp.ef.title",
    hookKey: "awp.ef.hook",
    speakerKeys: ["awp.ef.s1", "awp.ef.s2"],
    window: "16:00 – 16:50",
  },
  chapeau: {
    id: "chapeau",
    orgKey: "awp.chapeau.org",
    shortKey: "awp.chapeau.short",
    titleKey: "awp.chapeau.title",
    hookKey: "awp.chapeau.hook",
    speakerKeys: ["awp.chapeau.s1", "awp.chapeau.s2", "awp.chapeau.s3"],
    window: "17:00 – 17:30",
  },
  spoons: {
    id: "spoons",
    orgKey: "awp.spoons.org",
    shortKey: "awp.spoons.short",
    titleKey: "awp.spoons.title",
    hookKey: "awp.spoons.hook",
    speakerKeys: ["awp.spoons.s1"],
    window: "17:30 – 18:00",
  },
};

/** Programme, straight from the event description. 24h throughout: it's Milan. */
const SCHEDULE: { time: string; key?: string; panel?: string; us?: boolean }[] = [
  { time: "12:00", key: "aw.s1" },
  { time: "13:00", key: "aw.s2" },
  { time: "15:00", panel: "startlab" },
  { time: "16:00", panel: "ef" },
  { time: "17:00", panel: "chapeau" },
  { time: "17:30", panel: "spoons" },
  { time: "17:50", key: "aw.s6", us: true },
  { time: "18:00", key: "aw.s7" },
  { time: "20:00", key: "aw.s8" },
  { time: "21:30", key: "aw.s9" },
];

const PARTNERS = [
  { labelKey: "aw.partnersGold", names: ["EBS", "EF", "UniCredit"], color: AW.goldInk },
  { labelKey: "aw.partnersMobility", names: ["Dott"], color: AW.greenInk },
  { labelKey: "aw.partnersBar", names: ["DollyNoire District"], color: AW.magentaInk },
];

const MAPS_QUERY = "Parco delle Memorie Industriali, Milano";

/** Matches the ScrollView's own horizontal padding. */
const PAGE_PADDING = 20;
/** A touch taller than the poster's own 2:1. */
const CARD_RATIO = 1.75;

/**
 * The announcement artwork itself, rather than a re-drawn approximation. The
 * poster already carries the date and "un evento dell'Astra Network", so the
 * block underneath only repeats what is too small to read at phone width.
 */
function Hero() {
  const t = useT();
  const { width } = useWindowDimensions();
  const cardWidth = width - PAGE_PADDING * 2;
  const cardHeight = Math.round(cardWidth / CARD_RATIO);

  return (
    <View>
      {/* The same rounded card as the news stories on Home, just slightly
          taller, and with no scrim or overlaid title — here the artwork is the
          headline, so anything on top of it is in the way.
          "contain" rather than "cover" because the card is taller than the
          poster's own 2:1, and cover would crop the wordmark off the sides. The
          backdrop is sampled from the poster's own edge (#fdfdfd), so the
          letterboxing is invisible.
          Dimensions are explicit numbers, like the news carousel's — neither
          `aspectRatio` nor a percentage width constrained this bundled
          require() asset, which kept its intrinsic 1774px and rendered a
          magnified crop of one corner. */}
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
            {t("aw.dateShort")}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-extrabold text-gray-900 dark:text-white">
            {t("aw.tagline")}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-white/70">
            {t("aw.date")} · {t("aw.hours")}
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
function PanelSheet({ panel, onClose }: { panel: Panel | null; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={onClose}>
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
                {t(panel.orgKey as never)}
              </Text>
              <Text className="mt-1 text-[13px] font-bold" style={{ color: AW.greenInk }}>
                {panel.window}
              </Text>

              <Text className="mt-3 text-[21px] font-extrabold leading-7 text-gray-900 dark:text-white">
                {t(panel.titleKey as never)}
              </Text>

              <Text className="mt-3 text-[15px] leading-[23px] text-gray-600 dark:text-gray-300">
                {t(panel.hookKey as never)}
              </Text>

              {/* The panels run in Italian regardless of the app's language, so
                  say it here rather than letting an English-reading exchange
                  student find out when the session starts. */}
              <View className="mt-4 flex-row items-center gap-2 rounded-xl bg-astra-light dark:bg-white/10 px-3 py-2.5">
                <Icon name="language-outline" size={16} color={AW.navy} />
                <Text className="flex-1 text-[12px] font-semibold text-astra-primary dark:text-white">
                  {t("awp.inItalian")}
                </Text>
              </View>

              <Text className="mt-6 text-[11px] font-black uppercase tracking-[1.5px] text-gray-400 dark:text-white/50">
                {t("awp.speakers")}
              </Text>
              <View className="mt-2 gap-2">
                {panel.speakerKeys.map((k) => (
                  <View key={k} className="flex-row items-center gap-2.5">
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: AW.magenta,
                      }}
                    />
                    <Text className="flex-1 text-[14px] text-gray-800 dark:text-gray-100">
                      {t(k as never)}
                    </Text>
                  </View>
                ))}
              </View>

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
  const insets = useSafeAreaInsets();
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-astra-primary"
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Hero />

      {/* At-a-glance facts */}
      <View className="mt-4 flex-row flex-wrap gap-2">
        <Fact icon="location-outline" label={t("aw.venue")} tint={AW.magentaInk} />
        <Fact icon="ticket-outline" label={t("aw.entry")} tint={AW.greenInk} />
        <Fact icon="time-outline" label={t("aw.hours")} tint={AW.navy} />
      </View>

      <Pressable
        onPress={() =>
          Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(MAPS_QUERY)}`)
        }
        className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl py-3 active:opacity-85"
        style={{ backgroundColor: AW.navy }}
      >
        <Icon name="navigate-outline" size={16} color="#FFFFFF" />
        <Text className="text-sm font-bold text-white">{t("aw.directions")}</Text>
      </Pressable>

      <Body>{t("aw.intro")}</Body>

      {/* The day */}
      <SectionTitle tint={AW.magenta}>{t("aw.dayTitle")}</SectionTitle>
      <Body>{t("aw.dayP1")}</Body>
      <Body>{t("aw.dayP2")}</Body>
      <Body>{t("aw.dayP3")}</Body>

      {/* Programme */}
      <SectionTitle tint={AW.green}>{t("aw.programmeTitle")}</SectionTitle>
      <Text className="mt-1 text-[12px] text-gray-400 dark:text-white/50">
        {t("awp.tapHint")}
      </Text>
      <View className="mt-3">
        {SCHEDULE.map((row, i) => {
          const last = i === SCHEDULE.length - 1;
          const panel = row.panel ? PANELS[row.panel] : undefined;

          const body = (
            <View className="flex-1 pb-4">
              <Text
                className="text-[13px] font-black"
                style={{ color: row.us ? AW.magentaInk : AW.navy }}
              >
                {row.time}
              </Text>
              <View className="mt-0.5 flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="text-[14px] text-gray-800 dark:text-gray-100">
                    {panel ? t(panel.shortKey as never) : t(row.key as never)}
                  </Text>
                  {panel && (
                    <Text className="mt-0.5 text-[12px] text-gray-400 dark:text-white/50">
                      {t(panel.orgKey as never)}
                    </Text>
                  )}
                </View>
                {row.us && (
                  <View
                    className="rounded-full px-2 py-0.5"
                    style={{ backgroundColor: AW.magenta }}
                  >
                    <Text className="text-[10px] font-black text-white">{t("aw.usBadge")}</Text>
                  </View>
                )}
                {panel && <Icon name="chevron-forward" size={16} color={AW.magentaInk} />}
              </View>
            </View>
          );

          return (
            <View key={row.time + (row.panel ?? row.key ?? "")} className="flex-row">
              {/* Timeline rail */}
              <View className="items-center" style={{ width: 22 }}>
                <View
                  style={{
                    width: row.us || panel ? 12 : 8,
                    height: row.us || panel ? 12 : 8,
                    borderRadius: 6,
                    marginTop: 5,
                    backgroundColor: row.us ? AW.magenta : panel ? AW.greenInk : AW.navy,
                  }}
                />
                {!last && (
                  <View
                    style={{
                      flex: 1,
                      width: 2,
                      marginTop: 3,
                      backgroundColor: "rgba(4,16,126,0.15)",
                    }}
                  />
                )}
              </View>

              {panel ? (
                <Pressable
                  className="flex-1 flex-row active:opacity-60"
                  onPress={() => setOpenPanel(panel.id)}
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
        {t("aw.programmeNote")}
      </Text>

      {/* Village */}
      <SectionTitle tint={AW.yellow}>{t("aw.villageTitle")}</SectionTitle>
      <Body>{t("aw.villageBody")}</Body>

      {/* Two communities */}
      <SectionTitle tint={AW.navy}>{t("aw.communitiesTitle")}</SectionTitle>
      <Body>{t("aw.communitiesBody")}</Body>

      {/* Partners */}
      <SectionTitle tint={AW.red}>{t("aw.partnersTitle")}</SectionTitle>
      <View className="mt-3 gap-3">
        {PARTNERS.map((group) => (
          <View key={group.labelKey}>
            <Text
              className="text-[10px] font-black uppercase tracking-[1.5px]"
              style={{ color: group.color }}
            >
              {t(group.labelKey as never)}
            </Text>
            <View className="mt-1.5 flex-row flex-wrap gap-2">
              {group.names.map((name) => (
                <View
                  key={name}
                  className="rounded-xl border border-gray-200 dark:border-white/15 px-3 py-1.5"
                >
                  <Text className="text-[13px] font-bold text-gray-800 dark:text-white">
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">
        {t("aw.partnersContribution")}
      </Text>

      <PanelSheet
        panel={openPanel ? (PANELS[openPanel] ?? null) : null}
        onClose={() => setOpenPanel(null)}
      />
    </ScrollView>
  );
}
