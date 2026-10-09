import { useEffect, useState } from "react";
import { View, Pressable, Modal, StyleSheet, KeyboardAvoidingView, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import type { MeResponse, UpdateMeInput } from "@astra/shared";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Text } from "./AppText";
import { TextField } from "./TextField";
import { api } from "../lib/api";
import { alertAfterModal } from "../lib/alert";
import { useAuthStore } from "../lib/auth-store";
import { useT } from "../lib/i18n";
import { announce } from "../lib/use-reduced-motion";

const randomSeeds = (n: number) => Array.from({ length: n }, () => Math.random().toString(36).slice(2, 10));

/** Saves to /api/me, showing the change at once and undoing it if the save fails. */
function useUpdateMe() {
  const qc = useQueryClient();
  const t = useT();
  return async (input: UpdateMeInput, preview: Partial<MeResponse>) => {
    const previous = qc.getQueryData<MeResponse>(["me"]);
    qc.setQueryData<MeResponse>(["me"], (old) => (old ? { ...old, ...preview } : old));
    try {
      qc.setQueryData(["me"], await api.updateMe(input));
      announce(t("profile.saved"));
    } catch {
      if (previous) qc.setQueryData(["me"], previous);
      // The sheet that triggered this is still fading out: an alert shown now is dropped on iOS.
      alertAfterModal(t("profile.saveFailedTitle"), t("profile.saveFailedBody"));
    }
  };
}

function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* "padding" on Android too: edge-to-edge windows are not resized for the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} className="justify-end" accessibilityViewIsModal>
        <Pressable
          style={StyleSheet.absoluteFill}
          className="bg-black/40"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
        {/* Tall content (nine avatars at a large text size) scrolls instead of leaving the screen. */}
        <ScrollView
          className="rounded-t-3xl bg-white dark:bg-astra-primary"
          style={{ flexGrow: 0, maxHeight: "92%" }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 16 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Text accessibilityRole="header" className="pb-4 text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Big avatar + name at the top of Profile; both open an editor. */
export function ProfileIdentity({ me, subtitle }: { me: MeResponse; subtitle: React.ReactNode }) {
  const t = useT();
  const save = useUpdateMe();
  const [sheet, setSheet] = useState<"avatar" | "name" | null>(null);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [names, setNames] = useState({ first: "", last: "" });
  const pendingName = useAuthStore((s) => s.pendingName);
  const setPendingName = useAuthStore((s) => s.setPendingName);

  // A name typed at sign-in that did not save then is retried here, quietly.
  useEffect(() => {
    if (!pendingName || me.name) return;
    setPendingName(null);
    void save(pendingName, { name: `${pendingName.firstName} ${pendingName.lastName}` });
    // runs once per pending name; `save` is rebuilt every render
  }, [pendingName, me.name]);

  function openAvatar() {
    setSeeds([me.avatarSeed, ...randomSeeds(8)]);
    setSheet("avatar");
  }
  function openName() {
    const [first = "", ...rest] = (me.name ?? "").split(" ");
    setNames({ first, last: rest.join(" ") });
    setSheet("name");
  }
  const nameValid = names.first.trim() && names.last.trim();

  return (
    <View className="items-center gap-2 pt-4">
      <Pressable
        onPress={openAvatar}
        accessibilityRole="button"
        accessibilityLabel={t("profile.changeAvatar")}
        className="active:opacity-80"
      >
        <Avatar seed={me.avatarSeed} size={88} name={me.name} />
        <View className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-astra-primary bg-astra-primary dark:bg-white">
          <Icon name="shuffle" size={14} color="#FFFFFF" />
        </View>
      </Pressable>
      <Pressable
        onPress={openName}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={me.name ?? t("profile.addName")}
        accessibilityHint={t("profile.editNameHint")}
        className="min-h-[44px] flex-row items-center justify-center gap-1.5 active:opacity-70"
      >
        <Text className="text-xl font-semibold text-gray-900 dark:text-white">{me.name ?? t("profile.addName")}</Text>
        <Icon name="pencil" size={14} color="#6B7280" />
      </Pressable>
      {subtitle}

      <Sheet visible={sheet === "avatar"} onClose={() => setSheet(null)} title={t("profile.pickAvatar")}>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {seeds.map((seed, i) => {
            const current = seed === me.avatarSeed;
            return (
              <Pressable
                key={seed}
                onPress={() => {
                  setSheet(null);
                  void save({ avatarSeed: seed }, { avatarSeed: seed });
                }}
                accessibilityRole="radio"
                accessibilityLabel={t("profile.avatarN", { n: String(i + 1) })}
                accessibilityState={{ selected: current, checked: current }}
                className={`rounded-full p-1 ${current ? "bg-astra-primary dark:bg-white" : "active:opacity-70"}`}
              >
                <Avatar seed={seed} size={84} name={me.name} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setSeeds([me.avatarSeed, ...randomSeeds(8)])}
          accessibilityRole="button"
          className="mt-5 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-astra-primary/20 dark:border-white/15 py-3 active:opacity-70"
        >
          <Icon name="shuffle" size={16} color="#04107E" />
          <Text chrome className="text-[15px] font-semibold text-astra-primary dark:text-white">
            {t("profile.moreAvatars")}
          </Text>
        </Pressable>
      </Sheet>

      <Sheet visible={sheet === "name"} onClose={() => setSheet(null)} title={t("profile.yourName")}>
        <View className="gap-3">
          {(["first", "last"] as const).map((k) => (
            <TextField
              key={k}
              value={names[k]}
              onChangeText={(v) => setNames((n) => ({ ...n, [k]: v }))}
              placeholder={t(k === "first" ? "login.firstName" : "login.lastName")}
              accessibilityLabel={t(k === "first" ? "login.firstName" : "login.lastName")}
              placeholderTextColor="#6B7280"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              autoFocus={k === "first"}
              className="rounded-xl bg-gray-100 dark:bg-white/10 px-4 py-3 text-base text-gray-900 dark:text-white"
            />
          ))}
          <Pressable
            disabled={!nameValid}
            onPress={() => {
              const first = names.first.trim();
              const last = names.last.trim();
              setSheet(null);
              void save({ firstName: first, lastName: last }, { name: `${first} ${last}` });
            }}
            accessibilityRole="button"
            accessibilityState={{ disabled: !nameValid }}
            className={`mt-1 min-h-[48px] items-center justify-center rounded-xl bg-astra-primary dark:bg-white/15 py-3.5 ${nameValid ? "active:opacity-90" : "opacity-40"}`}
          >
            <Text chrome className="text-[15px] font-semibold text-white">
              {t("common.save")}
            </Text>
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}
