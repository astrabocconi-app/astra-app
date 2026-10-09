import { useMemo, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  Image,
  ScrollView,
  RefreshControl,
  Modal,
  Linking,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { Text } from "../../components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Icon, Spinner } from "../../components/Icon";
import { EmptyState } from "../../components/EmptyState";
import type { PartnerItem } from "@astra/shared";
import { queries } from "../../lib/prefetch";
import { useT } from "../../lib/i18n";
import { SegmentedToggle } from "../../components/SegmentedToggle";
import { DiscountsMap } from "../../components/DiscountsMap";
import { useRefresh } from "../../lib/use-refresh";

type ViewMode = "map" | "list";
const ALL = "__all__";

function openDirections(p: PartnerItem, onFail: () => void) {
  const query = p.address?.trim()
    ? encodeURIComponent(`${p.name}, ${p.address}`)
    : p.latitude != null && p.longitude != null
      ? `${p.latitude},${p.longitude}`
      : encodeURIComponent(p.name);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  if (url) Linking.openURL(url).catch(onFail);
}

function PartnerRow({
  partner,
  onDirections,
  onOpen,
}: {
  partner: PartnerItem;
  onDirections: () => void;
  onOpen: () => void;
}) {
  const t = useT();
  const hasMap = partner.latitude != null && partner.longitude != null;
  return (
    // Two controls, so two siblings: nesting the directions button inside the
    // row's own Pressable hid it from VoiceOver (an accessible parent swallows
    // its children).
    <View className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={[partner.name, partner.category, partner.address].filter(Boolean).join(", ")}
        className="p-4 active:opacity-80"
        style={{ paddingRight: hasMap ? 60 : 16 }}
      >
        <View className="flex-row items-start gap-3">
          {partner.logoUrl ? (
            <Image
              source={{ uri: partner.logoUrl }}
              resizeMode="cover"
              style={{ width: 44, height: 44, borderRadius: 12 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
              <Icon name="storefront" size={21} color="#04107E" />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{partner.name}</Text>
            <Text className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
              {partner.address ?? t("discounts.noAddress")}
            </Text>
            {partner.category ? (
              <Text maxFontSizeMultiplier={1.3} className="mt-1 self-start rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                {partner.category}
              </Text>
            ) : null}
          </View>
        </View>

        {partner.offers.length > 0 ? (
          <View className="mt-3 gap-1.5">
            {partner.offers.map((o) => (
              <View key={o.id} className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Text
                    maxFontSizeMultiplier={1.3}
                    className="rounded-full bg-astra-light dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-astra-primary dark:text-white"
                    numberOfLines={1}
                  >
                    {o.label}
                  </Text>
                  <Text className="flex-1 text-[13px] text-gray-700 dark:text-gray-200">{o.title}</Text>
                </View>
                {o.description ? (
                  <Text className="text-[12px] text-gray-600 dark:text-gray-400">{o.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text className="mt-3 text-[13px] text-gray-600 dark:text-white/70">{t("discounts.noDiscount")}</Text>
        )}
      </Pressable>

      {hasMap ? (
        <Pressable
          onPress={onDirections}
          hitSlop={4}
          className="absolute right-2 top-2 h-11 w-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={`${t("discounts.openInMaps")}, ${partner.name}`}
        >
          <Icon name="navigate-outline" size={20} color="#04107E" />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function DiscountsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  // Deep-linkable so a link can open straight to the list, e.g.
  // astra://discounts?view=list — handy for sharing and for screenshots.
  const params = useLocalSearchParams<{ view?: string }>();
  const [mode, setMode] = useState<ViewMode>(params.view === "list" ? "list" : "map");
  const [selectedCategory, setCategory] = useState<string>(ALL);
  const [pickerOpen, setPickerOpen] = useState(false);

  const q = useQuery(queries.partners());
  const refresh = useRefresh(q.refetch);

  const partners = useMemo(() => q.data?.items ?? [], [q.data]);
  const categories = useMemo(() => q.data?.categories ?? [], [q.data]);
  // A category that has since disappeared from the list (a refetch) is treated
  // as "all", not as a filter that matches nothing for no visible reason.
  const category = selectedCategory === ALL || categories.includes(selectedCategory) ? selectedCategory : ALL;
  const visible = useMemo(
    () => (category === ALL ? partners : partners.filter((p) => p.category === category)),
    [partners, category],
  );

  const categoryLabel = category === ALL ? t("discounts.allCategories") : category;

  function directions(p: PartnerItem) {
    openDirections(p, () => Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody")));
  }

  return (
    <View className="flex-1 bg-white dark:bg-astra-primary">
      {/* Header + view switch. This screen hides the navigator header, so it
          owns the status-bar inset itself — without this the title sits under
          the clock / Dynamic Island. */}
      <View className="gap-3 px-5 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View>
          <Text accessibilityRole="header" className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("discounts.title")}
          </Text>
          <Text className="text-xs text-gray-600 dark:text-white/70">{t("discounts.subtitle")}</Text>
        </View>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: "map", label: t("discounts.tabMap") },
            { value: "list", label: t("discounts.tabList") },
          ]}
        />
      </View>

      {/* Category filter. Above both modes, so the map never drops pins
          without saying why. */}
      {partners.length > 0 && categories.length > 0 && (
        <View className="px-5 pb-2">
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t("discounts.category")}: ${categoryLabel}`}
            accessibilityState={{ expanded: pickerOpen }}
            className="min-h-[44px] flex-row items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-white/15 px-4 py-2.5 active:bg-gray-50 dark:active:bg-white/5"
          >
            <Text chrome className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
              {categoryLabel}
            </Text>
            <Icon name="chevron-down" size={16} color="#6B7280" />
          </Pressable>
        </View>
      )}

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : q.isError && !q.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("discounts.loadError")}
          action={{ label: t("common.retry"), onPress: () => q.refetch() }}
        />
      ) : partners.length === 0 ? (
        <EmptyState icon="pricetags-outline" title={t("discounts.emptyTitle")} body={t("discounts.emptyBody")} />
      ) : mode === "map" ? (
        <DiscountsMap partners={visible} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl {...refresh} />}
          contentContainerStyle={{
            paddingHorizontal: 20,
            // The tab scene already ends above the bar.
            paddingBottom: 24,
            gap: 10,
            flexGrow: 1,
          }}
          ListEmptyComponent={<EmptyState icon="pricetags-outline" title={t("discounts.emptyFiltered")} />}
          renderItem={({ item }) => (
            <PartnerRow
              partner={item}
              onDirections={() => directions(item)}
              onOpen={() => router.push(`/venue/${item.id}`)}
            />
          )}
        />
      )}

      {/* Category picker sheet */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        {/* Backdrop sits behind the sheet as a sibling — nesting the sheet in a
            Pressable made the parent intercept taps meant for the options. */}
        <View className="flex-1 justify-end" accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            className="bg-black/40"
            onPress={() => setPickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          />
          <View
            className="rounded-t-3xl bg-white dark:bg-astra-primary pt-3"
            style={{ maxHeight: "70%", paddingBottom: insets.bottom + 12 }}
          >
            <Text accessibilityRole="header" className="px-5 pb-2 text-lg font-semibold text-gray-900 dark:text-white">
              {t("discounts.category")}
            </Text>
            <ScrollView accessibilityRole="radiogroup">
              {[ALL, ...categories].map((c) => {
                const selected = c === category;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setCategory(c);
                      setPickerOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    className="min-h-[52px] flex-row items-center justify-between px-5 py-4 active:bg-gray-50 dark:active:bg-white/5"
                  >
                    <Text
                      className={`flex-1 pr-3 text-base ${selected ? "font-semibold text-astra-primary dark:text-white" : "text-gray-800 dark:text-gray-100"}`}
                    >
                      {c === ALL ? t("discounts.allCategories") : c}
                    </Text>
                    {selected && <Icon name="checkmark" size={20} color="#04107E" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
