import { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Image,
  Linking,
  ActionSheetIOS,
  Alert,
  Platform,
} from "react-native";
import { Text } from "../../components/AppText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Icon, Spinner } from "../../components/Icon";
import { Button } from "../../components/Button";
import { ContentLinks } from "../../components/ContentLinks";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { api } from "../../lib/api";
import { useLocale, useT } from "../../lib/i18n";

// Tap an address → bottom chooser to open it in Apple Maps or Google Maps.
function openInMaps(address: string, t: ReturnType<typeof useT>) {
  const q = encodeURIComponent(address);
  const apple = `http://maps.apple.com/?q=${q}`;
  const google = `https://www.google.com/maps/search/?api=1&query=${q}`; // opens the app if installed, else web
  const go = (url: string) =>
    Linking.openURL(url).catch(() => Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody")));

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: address,
        options: [t("event.appleMaps"), t("event.googleMaps"), t("common.cancel")],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) go(apple);
        else if (i === 1) go(google);
      },
    );
  } else {
    Alert.alert(t("event.openLocationTitle"), address, [
      { text: t("event.googleMaps"), onPress: () => go(google) },
      { text: t("event.appleMaps"), onPress: () => go(apple) },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }
}

// Eventbrite's API can't sell tickets on our behalf, so checkout is their page,
// shown in an in-app sheet rather than a WebView: Apple Pay and saved cards
// only work in the system browser engine.
function openTickets(url: string, onFail: () => void) {
  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: "#04107E",
    toolbarColor: "#FFFFFF",
    dismissButtonStyle: "close",
    enableBarCollapsing: true,
  }).catch(() => Linking.openURL(url).catch(onFail));
}

function formatWhen(iso: string, locale: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }) +
    " · " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [opening, setOpening] = useState(false);
  const events = useQuery({ queryKey: ["events"], queryFn: () => api.events.list() });
  const event = events.data?.items.find((e) => e.id === id);
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();

  // Ask the server for this student's link first: with an in-app discount it
  // carries their personal code. If that fails, the plain link still sells a
  // ticket, but at full price: for an event that advertises a discount the
  // student is asked rather than silently sent to the dearer page.
  const [noDiscount, setNoDiscount] = useState(false);
  const plainUrl = event ? (event.externalTicketUrl ?? `https://www.eventbrite.com/e/${event.eventbriteEventId}`) : "";
  const open = (url: string) =>
    openTickets(url, () => Alert.alert(t("links.cannotOpenTitle"), t("links.cannotOpenBody")));

  async function getTickets() {
    if (!event || opening) return;
    setOpening(true);
    let failed: boolean;
    try {
      const link = await api.events.ticketLink(event.id);
      // No code back means no discount (none on this event, the cap is reached):
      // stop promising one.
      if (link.code === null) setNoDiscount(true);
      // "unavailable" is temporary: worth asking before they pay full price.
      if (link.discountStatus === "unavailable" && event.appDiscountPercent) {
        failed = true;
      } else {
        open(link.url);
        return;
      }
    } catch {
      failed = true;
    } finally {
      setOpening(false);
    }
    if (failed && event.appDiscountPercent) {
      Alert.alert(t("event.discountFailedTitle"), t("event.discountFailedBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("event.continueFull"), onPress: () => open(plainUrl) },
        { text: t("common.retry"), onPress: () => void getTickets() },
      ]);
    } else if (failed) {
      open(plainUrl);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title="" />

      {events.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : events.isError && !events.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.error")}
          action={{ label: t("common.retry"), onPress: () => events.refetch() }}
        />
      ) : !event ? (
        <EmptyState icon="calendar-outline" title={t("event.notAvailable")} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {event.imageUrl ? (
            <Image
              source={{ uri: event.imageUrl }}
              resizeMode="cover"
              style={{ width: "100%", aspectRatio: 16 / 9 }}
              accessibilityIgnoresInvertColors
            />
          ) : null}

          <View className="px-5 pt-5">
            <Text accessibilityRole="header" className="text-2xl font-semibold text-gray-900 dark:text-white">{event.title}</Text>

            <View className="mt-3 gap-2">
              <View className="flex-row items-center gap-2">
                <Icon name="time-outline" size={16} color="#04107E" />
                <Text className="text-sm text-gray-700 dark:text-gray-200">{formatWhen(event.startsAt, locale)}</Text>
              </View>
              {event.location ? (
                <Pressable
                  className="min-h-[44px] flex-row items-center gap-2 py-1.5 active:opacity-60"
                  onPress={() => openInMaps(event.location!, t)}
                  hitSlop={8}
                  accessibilityRole="link"
                >
                  <Icon name="location-outline" size={16} color="#04107E" />
                  <Text className="flex-1 text-sm font-medium text-astra-primary dark:text-white">
                    {event.location}
                  </Text>
                  <Icon name="open-outline" size={13} color="#04107E" />
                </Pressable>
              ) : null}
            </View>

            {event.description ? (
              <Text selectable className="mt-4 text-base leading-6 text-gray-600 dark:text-gray-300">
                {event.description}
              </Text>
            ) : null}
            <ContentLinks links={event.links} />
          </View>
        </ScrollView>
      )}

      {/* Get tickets */}
      {event && (event.externalTicketUrl || event.eventbriteEventId) ? (
        <View
          className="border-t border-gray-100 dark:border-white/10 px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {event.appDiscountPercent && !noDiscount ? (
            <View className="mb-2.5 flex-row items-center justify-center gap-1.5">
              <Icon name="pricetag-outline" size={14} color="#04107E" />
              <Text className="text-[13px] font-medium text-astra-primary dark:text-white">
                {t("event.appDiscount", { n: String(event.appDiscountPercent) })}
              </Text>
            </View>
          ) : null}
          <Button
            label={t("event.getTickets")}
            loading={opening}
            onPress={getTickets}
            icon={<Icon name="ticket-outline" size={18} color="#fff" />}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
