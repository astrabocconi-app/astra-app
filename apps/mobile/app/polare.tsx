import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { useT } from "../lib/i18n";

// Stella Polare — the press section. Empty until the articles source is wired in.
export default function PolareScreen() {
  const t = useT();
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      <ScreenHeader title={t("polare.title")} />
      <EmptyState icon="newspaper-outline" title={t("polare.empty")} />
    </SafeAreaView>
  );
}
