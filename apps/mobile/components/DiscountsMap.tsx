import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking, Platform } from "react-native";
import Mapbox, { MapView, Camera, MarkerView } from "@rnmapbox/maps";
import { Icon } from "./Icon";
import { BOCCONI_CAMPUS, type PartnerItem } from "@astra/shared";
import { MAPBOX_TOKEN } from "../lib/config";
import { CAMPUS_SHAPE, CAMPUS_LABEL_POINT } from "../lib/campus-geo";
import { useT } from "../lib/i18n";

const BRAND = "#04107E";

// Module scope: the SDK only needs telling once per process.
if (MAPBOX_TOKEN) Mapbox.setAccessToken(MAPBOX_TOKEN);
// We never use Mapbox's usage analytics, so switch the telemetry uploader off
// rather than leaving students' movement being reported by default.
Mapbox.setTelemetryEnabled(false);

const CAMPUS_CENTER: [number, number] = [BOCCONI_CAMPUS.longitude, BOCCONI_CAMPUS.latitude];
// Frames both campus blocks with a little of the surrounding streets, so
// nearby partner pins are visible without panning.
const CAMPUS_ZOOM = 14.6;

/** Opens the platform maps app with a driving/walking destination. */
function openDirections(p: PartnerItem) {
  if (p.latitude == null || p.longitude == null) return;
  const label = encodeURIComponent(p.name);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${p.latitude},${p.longitude}&q=${label}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`,
  });
  if (url) void Linking.openURL(url);
}

export function DiscountsMap({ partners }: { partners: PartnerItem[] }) {
  const t = useT();
  const cameraRef = useRef<Camera>(null);
  const [selected, setSelected] = useState<PartnerItem | null>(null);

  // Only partners with coordinates can be pinned; the rest still list fine.
  const pinned = partners.filter(
    (p): p is PartnerItem & { latitude: number; longitude: number } =>
      p.latitude != null && p.longitude != null,
  );

  if (!MAPBOX_TOKEN) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-gray-50 dark:bg-white/5 px-10">
        <Icon name="map-outline" size={32} color="#9CA3AF" />
        <Text className="text-center text-base font-semibold text-gray-700 dark:text-gray-200">
          {t("discounts.mapUnavailable")}
        </Text>
        <Text className="text-center text-sm text-gray-400 dark:text-white/60">{t("discounts.mapNeedsToken")}</Text>
      </View>
    );
  }

  function recenter() {
    cameraRef.current?.setCamera({
      centerCoordinate: CAMPUS_CENTER,
      zoomLevel: CAMPUS_ZOOM,
      animationDuration: 600,
    });
  }

  return (
    <View className="flex-1">
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.Street}
        scaleBarEnabled={false}
        logoEnabled
        attributionEnabled
        onPress={() => setSelected(null)}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: CAMPUS_CENTER, zoomLevel: CAMPUS_ZOOM }}
        />

        {/* Bocconi campus. Not a discount, so it gets a highlighted footprint
            rather than a pin — pins mean "there's an offer here". */}
        <Mapbox.ShapeSource id="campus-area" shape={CAMPUS_SHAPE}>
          <Mapbox.FillLayer
            id="campus-area-fill"
            style={{ fillColor: BRAND, fillOpacity: 0.13 }}
          />
          <Mapbox.LineLayer
            id="campus-area-outline"
            style={{ lineColor: BRAND, lineWidth: 2, lineOpacity: 0.55 }}
          />
        </Mapbox.ShapeSource>

        {/* Label sits centred on the campus itself — overlapping the highlight
            is fine and keeps the map tight. */}
        <MarkerView coordinate={CAMPUS_LABEL_POINT} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.campus} pointerEvents="none">
            <Icon name="school" size={14} color="#fff" />
            <Text style={styles.campusLabel}>{t("discounts.campus")}</Text>
          </View>
        </MarkerView>

        {pinned.map((p) => {
          const active = selected?.id === p.id;
          return (
            <MarkerView
              key={p.id}
              coordinate={[p.longitude, p.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap={active}
            >
              <Pressable onPress={() => setSelected(p)} hitSlop={8}>
                <View style={[styles.pin, active && styles.pinActive]}>
                  <Icon name="pricetag" size={13} color="#fff" />
                </View>
                <View style={[styles.pinTail, active && styles.pinTailActive]} />
              </Pressable>
            </MarkerView>
          );
        })}
      </MapView>

      {/* Re-centre control */}
      <Pressable onPress={recenter} style={styles.recenter} hitSlop={8}>
        <Icon name="locate" size={20} color={BRAND} />
      </Pressable>

      {/* Detail card for the tapped pin */}
      {selected && (
        <View style={styles.card}>
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-astra-light dark:bg-white/10">
              <Icon name="storefront" size={20} color={BRAND} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">{selected.name}</Text>
              <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
                {selected.address ?? t("discounts.noAddress")}
              </Text>
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={10}>
              <Icon name="close" size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          {selected.offers.length > 0 ? (
            <View className="mt-3 gap-1.5">
              {selected.offers.map((o) => (
                <View key={o.id} className="flex-row items-center gap-2">
                  <Text className="rounded-full bg-astra-primary dark:bg-astra-dark px-2 py-0.5 text-[11px] font-bold text-white">
                    {o.label}
                  </Text>
                  <Text className="flex-1 text-[13px] text-gray-700 dark:text-gray-200" numberOfLines={1}>
                    {o.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="mt-3 text-[13px] text-gray-400 dark:text-white/60">{t("discounts.noDiscount")}</Text>
          )}

          <Pressable
            onPress={() => openDirections(selected)}
            className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-astra-light dark:bg-white/10 py-2.5 active:opacity-70"
          >
            <Icon name="navigate" size={15} color={BRAND} />
            <Text className="text-sm font-semibold text-astra-primary dark:text-white">
              {t("discounts.openInMaps")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  campus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: BRAND,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  campusLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  pin: {
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: "#3B4AD0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinActive: { backgroundColor: BRAND, transform: [{ scale: 1.12 }] },
  pinTail: {
    alignSelf: "center",
    width: 2,
    height: 6,
    backgroundColor: "#fff",
  },
  pinTailActive: { backgroundColor: BRAND },
  recenter: {
    position: "absolute",
    right: 14,
    top: 14,
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  card: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});
