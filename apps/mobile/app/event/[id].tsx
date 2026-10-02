import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  ActionSheetIOS,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Icon, Spinner } from "../../components/Icon";
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
  const go = (url: string) => Linking.openURL(url);

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
function openTickets(url: string) {
  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: "#04107E",
    toolbarColor: "#FFFFFF",
    dismissButtonStyle: "close",
    enableBarCollapsing: true,
  }).catch(() => Linking.openURL(url));
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
  const events = useQuery({ queryKey: ["events"], queryFn: () => api.events.list(), retry: false });
  const event = events.data?.items.find((e) => e.id === id);
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title="" />

      {events.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : events.isError ? (
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
            <Image source={{ uri: event.imageUrl }} resizeMode="cover" style={{ width: "100%", aspectRatio: 16 / 9 }} />
          ) : null}

          <View className="px-5 pt-5">
            <Text className="text-2xl font-semibold text-gray-900 dark:text-white">{event.title}</Text>

            <View className="mt-3 gap-2">
              <View className="flex-row items-center gap-2">
                <Icon name="time-outline" size={16} color="#04107E" />
                <Text className="text-sm text-gray-700 dark:text-gray-200">{formatWhen(event.startsAt, locale)}</Text>
              </View>
              {event.location ? (
                <Pressable
                  className="flex-row items-center gap-2 py-1.5 active:opacity-60"
                  onPress={() => openInMaps(event.location!, t)}
                  hitSlop={8}
                  accessibilityRole="link"
                >
                  <Icon name="location-outline" size={16} color="#04107E" />
                  <Text className="text-sm font-medium text-astra-primary dark:text-white">
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
      {event?.externalTicketUrl ? (
        <View
          className="border-t border-gray-100 dark:border-white/10 px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-xl bg-astra-primary dark:bg-astra-dark py-3.5 active:opacity-90"
            onPress={() => openTickets(event.externalTicketUrl!)}
          >
            <Icon name="ticket-outline" size={18} color="#fff" />
            <Text className="text-base font-semibold text-white">{t("event.getTickets")}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
