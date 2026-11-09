import { useState } from "react";
import { View, ScrollView, Image, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Icon, Spinner } from "../../components/Icon";
import { Text } from "../../components/AppText";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { ContentLinks } from "../../components/ContentLinks";
import { RedeemViewer, redeemPages } from "../../components/RedeemViewer";
import { useMapSponsors } from "../../lib/app-content";
import { useT } from "../../lib/i18n";
import { useEggStore } from "../../lib/egg-store";

// A mobility sponsor's page, opened from the map's "get there fast" sheet. All
// of it (picture, text, buttons, the how-to-redeem walkthrough) comes from the
// backoffice "App overlays" page.
export default function SponsorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const inverted = useEggStore((s) => s.inverted);
  const content = useMapSponsors();
  const sponsor = content?.sponsors.find((s) => s.id === id) ?? null;
  const [redeemOpen, setRedeemOpen] = useState(false);
  const canRedeem = sponsor ? redeemPages(sponsor).length > 0 : false;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={sponsor?.name ?? ""} />

      {content === undefined ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : !sponsor ? (
        <EmptyState icon="bicycle-outline" title={t("overlays.sponsorNotAvailable")} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {sponsor.imageUrl ? (
              <Image
                source={{ uri: sponsor.imageUrl }}
                resizeMode="cover"
                style={{ width: "100%", aspectRatio: 16 / 9 }}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <View className="px-5 pt-5">
              <View className="flex-row items-center gap-3">
                {sponsor.logoUrl ? (
                  <Image
                    source={{ uri: sponsor.logoUrl }}
                    resizeMode="cover"
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" }}
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
                <View className="flex-1">
                  <Text accessibilityRole="header" className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {sponsor.title || sponsor.name}
                  </Text>
                  {sponsor.tagline ? (
                    <Text className="mt-0.5 text-sm font-medium text-astra-primary dark:text-white/80">{sponsor.tagline}</Text>
                  ) : null}
                </View>
              </View>

              {sponsor.body ? (
                <Text className="mt-4 text-base leading-6 text-gray-700 dark:text-gray-200">{sponsor.body}</Text>
              ) : null}

              <ContentLinks links={sponsor.links} />
            </View>
          </ScrollView>

          {canRedeem ? (
            <View className="border-t border-gray-100 dark:border-white/10 px-5 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
              <Pressable
                onPress={() => setRedeemOpen(true)}
                accessibilityRole="button"
                className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-2xl bg-astra-primary dark:bg-white px-4 py-3.5 active:opacity-90"
              >
                <Icon name="play-circle" size={20} color={inverted ? "#04107E" : "#FFFFFF"} />
                <Text chrome className="text-base font-semibold text-white dark:text-astra-primary">
                  {sponsor.redeemLabel || t("overlays.howToRedeem")}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {redeemOpen ? <RedeemViewer sponsor={sponsor} onClose={() => setRedeemOpen(false)} /> : null}
        </>
      )}
    </SafeAreaView>
  );
}
