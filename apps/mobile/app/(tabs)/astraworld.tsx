import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Rect, Polygon, Path } from "react-native-svg";
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

/** Programme, straight from the event description. 24h throughout: it's Milan. */
const SCHEDULE: { time: string; key: string; us?: boolean }[] = [
  { time: "12:00", key: "aw.s1" },
  { time: "13:00", key: "aw.s2" },
  { time: "15:00", key: "aw.s3" },
  { time: "16:00", key: "aw.s4" },
  { time: "17:00", key: "aw.s5" },
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

function Hero() {
  const t = useT();
  return (
    <View className="overflow-hidden rounded-3xl" style={{ backgroundColor: AW.navy }}>
      {/* Poster-ish colour blocking. Purely decorative, so it stays behind the
          text and is hidden from screen readers. */}
      <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
        <Svg width="100%" height="100%" viewBox="0 0 340 250" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={AW.magenta} stopOpacity="0.95" />
              <Stop offset="1" stopColor={AW.navy} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="340" height="250" fill={AW.navy} />
          <Path d="M-20 0 L150 0 L40 250 L-20 250 Z" fill="url(#sweep)" />
          <Polygon points="250,250 285,150 320,250" fill={AW.green} opacity="0.9" />
          <Polygon points="292,250 315,196 340,250" fill={AW.yellow} opacity="0.85" />
        </Svg>
      </View>

      <View className="px-6 pb-6 pt-7">
        <Text
          className="text-[11px] font-bold uppercase tracking-[2px]"
          style={{ color: AW.green }}
        >
          {t("aw.kicker")}
        </Text>

        <Text
          className="mt-3 text-white"
          style={{ fontSize: 46, lineHeight: 44, fontWeight: "900", letterSpacing: -1.5 }}
        >
          ASTRA
        </Text>
        <Text
          style={{
            fontSize: 46,
            lineHeight: 48,
            fontWeight: "900",
            letterSpacing: -1.5,
            color: AW.magenta,
          }}
        >
          WORLD
        </Text>

        <Text className="mt-3 text-base font-semibold text-white/90">{t("aw.tagline")}</Text>

        <View className="mt-5 flex-row items-end gap-3">
          <View className="rounded-2xl px-3.5 py-2" style={{ backgroundColor: AW.magenta }}>
            <Text className="text-[22px] font-black text-white" style={{ letterSpacing: -0.5 }}>
              {t("aw.dateShort")}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-white">{t("aw.date")}</Text>
            <Text className="text-xs text-white/70">{t("aw.hours")}</Text>
          </View>
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

export default function AstraWorldScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();

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

      {/* Featured panel */}
      <View
        className="mt-5 rounded-2xl p-4"
        style={{ backgroundColor: "rgba(240,21,155,0.08)", borderWidth: 1, borderColor: "rgba(240,21,155,0.25)" }}
      >
        <Text
          className="text-[10px] font-black uppercase tracking-[1.5px]"
          style={{ color: AW.magentaInk }}
        >
          {t("aw.panelLabel")}
        </Text>
        <Text className="mt-1.5 text-base font-extrabold text-gray-900 dark:text-white">
          {t("aw.panelTitle")}
        </Text>
        <Text className="mt-1.5 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
          {t("aw.panelBody")}
        </Text>
        <Text className="mt-2.5 text-[12px] italic text-gray-400 dark:text-white/50">
          {t("aw.panelTba")}
        </Text>
      </View>

      {/* Programme */}
      <SectionTitle tint={AW.green}>{t("aw.programmeTitle")}</SectionTitle>
      <View className="mt-3">
        {SCHEDULE.map((row, i) => {
          const last = i === SCHEDULE.length - 1;
          return (
            <View key={row.time + row.key} className="flex-row">
              {/* Timeline rail */}
              <View className="items-center" style={{ width: 22 }}>
                <View
                  style={{
                    width: row.us ? 12 : 8,
                    height: row.us ? 12 : 8,
                    borderRadius: 6,
                    marginTop: 5,
                    backgroundColor: row.us ? AW.magenta : AW.navy,
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

              <View className={`flex-1 pb-4 ${row.us ? "" : ""}`}>
                <Text
                  className="text-[13px] font-black"
                  style={{ color: row.us ? AW.magentaInk : AW.navy }}
                >
                  {row.time}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-2">
                  <Text className="flex-1 text-[14px] text-gray-800 dark:text-gray-100">
                    {t(row.key as never)}
                  </Text>
                  {row.us && (
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: AW.magenta }}
                    >
                      <Text className="text-[10px] font-black text-white">{t("aw.usBadge")}</Text>
                    </View>
                  )}
                </View>
              </View>
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
    </ScrollView>
  );
}
