import { useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";

// "tooSoon" is not a failure: the card is valid, the perk was simply used
// recently. Staff need to tell those apart at a glance.
type ScanOutcome = "ok" | "tooSoon" | "error";
type ScanResult = { outcome: ScanOutcome; title: string; subtitle?: string };
type Offer = { id: string; title: string; label: string };

// Partner scanner — point the camera at a student's card QR to award points.
export default function ScanScreen() {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  // Card token held between decoding the QR and the staff member picking which
  // promotion the scan was for.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const lock = useRef(false);
  const qc = useQueryClient();

  // The venue's live promotions. Available to scan-only logins too — choosing
  // the offer is part of scanning, not analytics.
  const offersQuery = useQuery({
    queryKey: ["partner-offers"],
    queryFn: () => api.partner.offers(),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const offers: Offer[] = offersQuery.data?.offers ?? [];
  // Nothing may be scanned until we know the venue's offers. Otherwise a scan
  // taken while this was still loading saw an empty list, concluded there was
  // nothing to ask about, and silently awarded with no offer attached.
  const offersReady = offersQuery.isFetched || offersQuery.isError;

  // The same card sitting in front of the lens fires the barcode callback many
  // times a second, and re-fires the moment the success overlay is dismissed.
  // Remember the last code so it can't be awarded twice in a row by accident.
  const lastScan = useRef<{ token: string; at: number } | null>(null);
  const SAME_CODE_COOLDOWN_MS = 6000;

  async function award(token: string, offerId: string | null) {
    setBusy(true);
    try {
      const res = await api.partner.scan(token, offerId);
      setResult({
        outcome: "ok",
        title: t("partnerScan.scannedTitle"),
        subtitle: [
          res.student.name
            ? t("partnerScan.studentCard", { name: res.student.name })
            : t("partnerScan.memberCard"),
          res.offer?.title,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["partner-stats"] });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setResult({
        outcome: code === "TOO_SOON" ? "tooSoon" : "error",
        title:
          code === "TOO_SOON" ? t("partnerScan.alreadyUsedTitle") : t("partnerScan.failedTitle"),
        subtitle: e instanceof Error ? e.message : t("partnerScan.tryAgain"),
      });
    } finally {
      setBusy(false);
      setPendingToken(null);
      // Start the cooldown when the scan finishes, not when it began, so it
      // covers the moment staff dismiss the overlay with the card still in view.
      lastScan.current = { token, at: Date.now() };
    }
  }

  async function onScan({ data }: BarcodeScanningResult) {
    if (lock.current || busy || result || pendingToken) return;
    // Wait for the offer list before deciding whether to ask.
    if (!offersReady) return;
    const previous = lastScan.current;
    if (previous?.token === data && Date.now() - previous.at < SAME_CODE_COOLDOWN_MS) return;

    lock.current = true;
    lastScan.current = { token: data, at: Date.now() };
    // Ask which promotion first, then award — never the other way round. With
    // one offer (or none) there's nothing to ask, so award straight away and
    // keep the queue moving.
    if (offers.length > 1) {
      setPendingToken(data);
      return;
    }
    await award(data, offers[0]?.id ?? null);
  }

  /** After an award — the cooldown stands, so the same card isn't counted twice. */
  function reset() {
    setResult(null);
    setPendingToken(null);
    lock.current = false;
  }

  /** Backing out of the offer picker: nothing was awarded, so allow an
   *  immediate re-scan of the same card rather than making staff wait. */
  function cancelPending() {
    setPendingToken(null);
    lock.current = false;
    lastScan.current = null;
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-8">
        <Ionicons name="camera-outline" size={44} color="#04107E" />
        <Text className="text-center text-gray-700">
          {t("partnerScan.cameraPermissionText")}
        </Text>
        <Pressable className="rounded-xl bg-astra-primary px-6 py-3" onPress={requestPermission}>
          <Text className="font-semibold text-white">{t("partnerScan.grantCameraAccess")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={result || pendingToken || !offersReady ? undefined : onScan}
      />

      <SafeAreaView className="flex-1" edges={["top"]}>
        <Text className="mt-4 text-center text-base font-semibold text-white">
          {offersReady ? t("partnerScan.scanMemberCard") : t("partnerScan.preparing")}
        </Text>
        <View className="flex-1 items-center justify-center">
          <View
            style={{
              width: 240,
              height: 240,
              borderWidth: 3,
              borderColor: "rgba(255,255,255,0.9)",
              borderRadius: 24,
            }}
          />
        </View>
      </SafeAreaView>

      {busy && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {/* Which promotion was this scan for? Only asked when the venue runs
          more than one, so single-offer venues keep a one-tap flow. */}
      {pendingToken && !busy && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor: "rgba(0,0,0,0.75)", padding: 24 },
          ]}
        >
          <View className="w-full rounded-3xl bg-white p-6" style={{ maxWidth: 360 }}>
            <Text className="text-xl font-bold text-gray-900">
              {t("partnerScan.whichOfferTitle")}
            </Text>
            <Text className="mt-1 text-sm text-gray-500">{t("partnerScan.whichOfferBody")}</Text>

            <ScrollView style={{ maxHeight: 320 }} className="mt-4">
              <View className="gap-2">
                {offers.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => award(pendingToken, o.id)}
                    className="flex-row items-center gap-3 rounded-2xl border border-gray-200 p-4 active:bg-gray-50"
                  >
                    <Text className="rounded-full bg-astra-primary px-2 py-0.5 text-[11px] font-bold text-white">
                      {o.label}
                    </Text>
                    <Text className="flex-1 text-[15px] font-medium text-gray-900">{o.title}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable
              onPress={() => award(pendingToken, null)}
              className="mt-3 items-center rounded-xl bg-astra-light py-3 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-astra-primary">
                {t("partnerScan.noSpecificOffer")}
              </Text>
            </Pressable>
            <Pressable onPress={cancelPending} className="mt-2 items-center py-2">
              <Text className="text-sm text-gray-500">{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {result && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor: "rgba(0,0,0,0.75)", padding: 32 },
          ]}
        >
          <View className="w-full items-center rounded-3xl bg-white p-8" style={{ maxWidth: 340 }}>
            <View
              className={`h-16 w-16 items-center justify-center rounded-full ${
                result.outcome === "ok"
                  ? "bg-green-100"
                  : result.outcome === "tooSoon"
                    ? "bg-amber-100"
                    : "bg-red-100"
              }`}
            >
              <Ionicons
                name={
                  result.outcome === "ok"
                    ? "checkmark"
                    : result.outcome === "tooSoon"
                      ? "time-outline"
                      : "close"
                }
                size={36}
                color={
                  result.outcome === "ok"
                    ? "#16a34a"
                    : result.outcome === "tooSoon"
                      ? "#d97706"
                      : "#dc2626"
                }
              />
            </View>
            <Text className="mt-4 text-2xl font-bold text-gray-900">{result.title}</Text>
            {result.subtitle && (
              <Text className="mt-1 text-center text-gray-500">{result.subtitle}</Text>
            )}
            <Pressable
              className="mt-6 w-full items-center rounded-xl bg-astra-primary px-6 py-3"
              onPress={reset}
            >
              <Text className="font-semibold text-white">{t("partnerScan.scanNext")}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
