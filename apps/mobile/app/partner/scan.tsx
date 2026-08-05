import { useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";

type ScanResult = { ok: boolean; title: string; subtitle?: string };

// Partner scanner — point the camera at a student's card QR to award points.
export default function ScanScreen() {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const lock = useRef(false);
  const qc = useQueryClient();

  async function onScan({ data }: BarcodeScanningResult) {
    if (lock.current || busy || result) return;
    lock.current = true;
    setBusy(true);
    try {
      const res = await api.partner.scan(data);
      setResult({
        ok: true,
        title: t("partnerScan.scannedTitle"),
        subtitle: res.student.name
          ? t("partnerScan.studentCard", { name: res.student.name })
          : t("partnerScan.memberCard"),
      });
      qc.invalidateQueries({ queryKey: ["partner-stats"] });
    } catch (e) {
      setResult({
        ok: false,
        title: t("partnerScan.failedTitle"),
        subtitle: e instanceof Error ? e.message : t("partnerScan.tryAgain"),
      });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    lock.current = false;
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
        onBarcodeScanned={result ? undefined : onScan}
      />

      <SafeAreaView className="flex-1" edges={["top"]}>
        <Text className="mt-4 text-center text-base font-semibold text-white">
          {t("partnerScan.scanMemberCard")}
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
                result.ok ? "bg-green-100" : "bg-red-100"
              }`}
            >
              <Ionicons
                name={result.ok ? "checkmark" : "close"}
                size={36}
                color={result.ok ? "#16a34a" : "#dc2626"}
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
