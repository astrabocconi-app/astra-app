import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Icon } from "../components/Icon";
import { api } from "../lib/api";
import { useT } from "../lib/i18n";

type Kind = "QUESTION" | "ISSUE" | "IDEA";

const KINDS: { value: Kind; icon: string; labelKey: string }[] = [
  { value: "QUESTION", icon: "help-circle-outline", labelKey: "support.kindQuestion" },
  { value: "ISSUE", icon: "bug-outline", labelKey: "support.kindIssue" },
  { value: "IDEA", icon: "bulb-outline", labelKey: "support.kindIdea" },
];

/** Matches the server's own floor, so the button explains itself before sending. */
const MIN_LENGTH = 10;
const MAX_LENGTH = 4000;

/**
 * Support — questions, issues and ideas, sent straight to the backoffice.
 *
 * There is no email field on purpose: the message is tied to the signed-in
 * account, so ASTRA always has a working address to reply to and nobody can
 * mistype their own. The app version and platform ride along so a bug report
 * arrives with the context someone would otherwise have to ask for.
 */
export default function SupportScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>("QUESTION");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const trimmed = message.trim();
  const canSend = trimmed.length >= MIN_LENGTH && !sending;

  async function submit() {
    Keyboard.dismiss();
    setSending(true);
    try {
      await api.support({
        kind,
        message: trimmed,
        appVersion: Constants.expoConfig?.version ?? null,
        platform: Platform.OS,
      });
      setSent(true);
    } catch (e) {
      Alert.alert(
        t("support.failedTitle"),
        e instanceof Error ? e.message : t("support.failedBody"),
      );
    } finally {
      setSending(false);
    }
  }

  const header = (
    <View className="flex-row items-center gap-2 border-b border-gray-100 dark:border-white/10 px-4 py-3">
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Icon name="chevron-back" size={26} color="#04107E" />
      </Pressable>
      <View>
        <Text className="text-lg font-semibold text-astra-primary dark:text-white">
          {t("support.title")}
        </Text>
        <Text className="text-xs text-gray-400 dark:text-white/60">{t("support.subtitle")}</Text>
      </View>
    </View>
  );

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
        {header}
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
            <Icon name="checkmark" size={34} color="#16a34a" />
          </View>
          <Text className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {t("support.sentTitle")}
          </Text>
          <Text className="text-center text-gray-500 dark:text-gray-300">
            {t("support.sentBody")}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-3 rounded-xl bg-astra-primary px-6 py-3 active:opacity-90"
          >
            <Text className="font-semibold text-white">{t("common.done")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-astra-primary" edges={["top"]}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-sm leading-5 text-gray-600 dark:text-gray-300">
            {t("support.intro")}
          </Text>

          {/* What kind of message this is — drives triage in the backoffice. */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
              {t("support.kindLabel")}
            </Text>
            <View className="flex-row gap-2">
              {KINDS.map((k) => {
                const active = kind === k.value;
                return (
                  <Pressable
                    key={k.value}
                    onPress={() => setKind(k.value)}
                    className={`flex-1 items-center gap-1.5 rounded-2xl border py-3 active:opacity-80 ${
                      active
                        ? "border-astra-primary bg-astra-light dark:bg-white/10"
                        : "border-gray-200 dark:border-white/15"
                    }`}
                  >
                    <Icon
                      name={k.icon as never}
                      size={20}
                      color={active ? "#04107E" : "#9CA3AF"}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        active
                          ? "text-astra-primary dark:text-white"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {t(k.labelKey as never)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/60">
              {t("support.messageLabel")}
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={t("support.placeholder")}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={MAX_LENGTH}
              textAlignVertical="top"
              className="rounded-2xl border border-gray-200 dark:border-white/15 px-4 py-3 text-[15px] text-gray-900 dark:text-white"
              style={{ minHeight: 160 }}
            />
            <Text className="text-right text-[11px] text-gray-400">
              {trimmed.length}/{MAX_LENGTH}
            </Text>
          </View>

          {/* Says who it comes from, so the absence of an email field reads as
              deliberate rather than as something we forgot to ask for. */}
          <View className="flex-row items-start gap-2 rounded-2xl bg-astra-light dark:bg-white/10 px-4 py-3">
            <Icon name="information-circle-outline" size={18} color="#04107E" />
            <Text className="flex-1 text-xs leading-4 text-astra-primary dark:text-white">
              {t("support.privacyNote")}
            </Text>
          </View>

          <Pressable
            disabled={!canSend}
            onPress={submit}
            className="items-center rounded-xl py-3.5 active:opacity-90"
            style={{ backgroundColor: canSend ? "#04107E" : "#E5E7EB" }}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`text-sm font-semibold ${canSend ? "text-white" : "text-gray-500"}`}
              >
                {trimmed.length < MIN_LENGTH && trimmed.length > 0
                  ? t("support.tooShort")
                  : t("support.send")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
