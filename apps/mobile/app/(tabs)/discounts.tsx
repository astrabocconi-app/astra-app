import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "../../components/Icon";
import type { PartnerItem } from "@astra/shared";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { SegmentedToggle } from "../../components/SegmentedToggle";
import { DiscountsMap } from "../../components/DiscountsMap";

type ViewMode = "map" | "list";
const ALL = "__all__";

function openDirections(p: PartnerItem) {
  const query = p.address?.trim()
    ? encodeURIComponent(`${p.name}, ${p.address}`)
    : p.latitude != null && p.longitude != null
      ? `${p.latitude},${p.longitude}`
      : encodeURIComponent(p.name);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  if (url) void Linking.openURL(url);
}

function PartnerRow({ partner, onDirections }: { partner: PartnerItem; onDirections: () => void }) {
  const t = useT();
  return (
    <View className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-astra-primary p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
          <Icon name="storefront" size={21} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{partner.name}</Text>
          <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
            {partner.address ?? t("discounts.noAddress")}
          </Text>
          {partner.category ? (
            <Text className="mt-1 self-start rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-300">
              {partner.category}
            </Text>
          ) : null}
        </View>
        {partner.latitude != null && partner.longitude != null ? (
          <Pressable onPress={onDirections} hitSlop={8} className="p-1">
            <Icon name="navigate-outline" size={19} color="#04107E" />
          </Pressable>
        ) : null}
      </View>

      {partner.offers.length > 0 ? (
        <View className="mt-3 gap-1.5">
          {partner.offers.map((o) => (
            <View key={o.id} className="flex-row items-center gap-2">
              <Text className="rounded-full bg-astra-primary dark:bg-astra-dark px-2 py-0.5 text-[11px] font-bold text-white">
                {o.label}
              </Text>
              <Text className="flex-1 text-[13px] text-gray-700 dark:text-gray-200">{o.title}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="mt-3 text-[13px] text-gray-400 dark:text-white/60">{t("discounts.noDiscount")}</Text>
      )}
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
  const [category, setCategory] = useState<string>(ALL);
  const [pickerOpen, setPickerOpen] = useState(false);

  const q = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.partners.list(),
    retry: false,
  });

  const partners = useMemo(() => q.data?.items ?? [], [q.data]);
  const categories = q.data?.categories ?? [];
  const visible = useMemo(
    () => (category === ALL ? partners : partners.filter((p) => p.category === category)),
    [partners, category],
  );

  const categoryLabel = category === ALL ? t("discounts.allCategories") : category;

  return (
    <View className="flex-1 bg-white dark:bg-astra-primary">
      {/* Header + view switch. This screen hides the navigator header, so it
          owns the status-bar inset itself — without this the title sits under
          the clock / Dynamic Island. */}
      <View className="gap-3 px-5 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View>
          <Text className="text-2xl font-semibold text-gray-900 dark:text-white">{t("discounts.title")}</Text>
          <Text className="text-xs text-gray-400 dark:text-white/60">{t("discounts.subtitle")}</Text>
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

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#04107E" />
        </View>
      ) : q.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <Icon name="cloud-offline-outline" size={30} color="#9CA3AF" />
          <Text className="text-center text-gray-500 dark:text-gray-300">{t("discounts.loadError")}</Text>
          <Pressable
            onPress={() => q.refetch()}
            className="rounded-full bg-astra-primary dark:bg-astra-dark px-5 py-2 active:opacity-80"
          >
            <Text className="font-medium text-white">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : partners.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light dark:bg-white/10">
            <Icon name="pricetags-outline" size={28} color="#04107E" />
          </View>
          <Text className="text-xl font-semibold text-astra-primary dark:text-white">
            {t("discounts.emptyTitle")}
          </Text>
          <Text className="text-center text-gray-500 dark:text-gray-300">{t("discounts.emptyBody")}</Text>
        </View>
      ) : mode === "map" ? (
        <DiscountsMap partners={visible} />
      ) : (
        <>
          {/* Category filter */}
          {categories.length > 0 && (
            <View className="px-5 pb-2">
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center justify-between rounded-xl border border-gray-200 dark:border-white/15 px-4 py-2.5 active:bg-gray-50"
              >
                <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">{categoryLabel}</Text>
                <Icon name="chevron-down" size={16} color="#9CA3AF" />
              </Pressable>
            </View>
          )}

          <FlatList
            data={visible}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 90,
              gap: 10,
              flexGrow: 1,
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-10 pt-20">
                <Text className="text-center text-gray-400 dark:text-white/60">{t("discounts.emptyFiltered")}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <PartnerRow partner={item} onDirections={() => openDirections(item)} />
            )}
          />
        </>
      )}

      {/* Category picker sheet */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        {/* Backdrop sits behind the sheet as a sibling — nesting the sheet in a
            Pressable made the parent intercept taps meant for the options. */}
        <View className="flex-1 justify-end">
          <Pressable
            style={StyleSheet.absoluteFill}
            className="bg-black/40"
            onPress={() => setPickerOpen(false)}
          />
          <View
            className="rounded-t-3xl bg-white dark:bg-astra-primary pt-3"
            style={{ maxHeight: "70%", paddingBottom: insets.bottom + 12 }}
          >
            <View className="mb-2 items-center">
              <View className="h-1 w-10 rounded-full bg-gray-300" />
            </View>
            <Text className="px-5 pb-2 text-lg font-semibold text-gray-900 dark:text-white">
              {t("discounts.allCategories")}
            </Text>
            <ScrollView>
              {[ALL, ...categories].map((c) => {
                const selected = c === category;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setCategory(c);
                      setPickerOpen(false);
                    }}
                    className="flex-row items-center justify-between px-5 py-4 active:bg-gray-50"
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
