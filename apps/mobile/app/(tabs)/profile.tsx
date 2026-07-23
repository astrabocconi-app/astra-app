import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Modal, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { clearToken } from "../../lib/session";
import { sendTestNotification } from "../../lib/push";
import { useProfileStore, COURSES, YEARS, shortCourse } from "../../lib/profile-store";

type Picker = "course" | "year" | null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
    retry: false,
  });

  const { course, year, hydrate, setCourse, setYear } = useProfileStore();
  const [picker, setPicker] = useState<Picker>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function signOut() {
    await clearToken();
    queryClient.clear();
    router.replace("/");
  }

  // Course options show the full name but store the acronym; years are plain.
  const pickerOptions: { value: string; label: string }[] =
    picker === "course"
      ? COURSES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))
      : YEARS.map((y) => ({ value: y, label: y }));
  const currentValue = picker === "course" ? course : year;

  async function choose(value: string) {
    if (picker === "course") await setCourse(value);
    else if (picker === "year") await setYear(value);
    setPicker(null);
  }

  return (
    <View className="flex-1 bg-white p-5">
      {isLoading && <ActivityIndicator />}

      {error && (
        <View className="gap-2">
          <Text className="text-red-600">{String((error as Error).message)}</Text>
          <Pressable className="rounded-lg border border-gray-300 px-4 py-3" onPress={() => refetch()}>
            <Text className="text-center">Retry</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <View className="items-center gap-2 pt-4">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-astra-light">
            <Ionicons name="person" size={36} color="#04107E" />
          </View>
          <Text className="text-xl font-semibold text-gray-900">
            {data.name?.split(" ")[0] ?? "Student"}
          </Text>
          {/* Course · year shown next to the name once selected */}
          {course || year ? (
            <Text className="text-sm text-gray-500">
              {[shortCourse(course), year].filter(Boolean).join(" · ")}
            </Text>
          ) : (
            <Text className="text-sm text-gray-400">Add your course & year below</Text>
          )}
          <View className="mt-1 flex-row gap-2">
            {data.roles.map((r) => (
              <Text
                key={r}
                className="rounded-full bg-astra-light px-3 py-1 text-xs font-medium text-astra-primary"
              >
                {r}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Academic — course & year (filters materials to your course later) */}
      <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Academic
      </Text>
      <View className="gap-2">
        <Pressable
          className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
          onPress={() => setPicker("course")}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
            <Ionicons name="book-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500">Course</Text>
            <Text className="text-base font-semibold text-gray-900">{shortCourse(course) ?? "Select your course"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        <Pressable
          className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
          onPress={() => setPicker("year")}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
            <Ionicons name="calendar-outline" size={22} color="#04107E" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500">Year</Text>
            <Text className="text-base font-semibold text-gray-900">{year ?? "Select your year"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Services */}
      <Text className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Services
      </Text>
      <Pressable
        className="flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
        onPress={() => router.push("/classrooms")}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
          <Ionicons name="school-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">Find a free classroom</Text>
          <Text className="text-xs text-gray-500">Live room availability · Free@B</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      <Pressable
        className="mt-2 flex-row items-center gap-3 rounded-2xl border border-gray-100 p-4 active:bg-gray-50"
        onPress={async () => Alert.alert("Notifications", await sendTestNotification())}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-astra-light">
          <Ionicons name="notifications-outline" size={22} color="#04107E" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">Send test notification</Text>
          <Text className="text-xs text-gray-500">Preview how alerts appear</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      <View className="flex-1" />

      {/* Sign out — lifted clear of the tab bar, red outline */}
      <Pressable
        className="flex-row items-center justify-center gap-2 rounded-xl border-2 border-red-500 px-4 py-3 active:bg-red-50"
        style={{ marginBottom: insets.bottom + 76 }}
        onPress={signOut}
      >
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text className="text-center font-semibold text-red-600">Sign out</Text>
      </Pressable>

      {/* Course / year picker */}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPicker(null)}>
          <Pressable
            className="rounded-t-3xl bg-white pt-3"
            style={{ maxHeight: "70%", paddingBottom: insets.bottom + 12 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 items-center">
              <View className="h-1 w-10 rounded-full bg-gray-300" />
            </View>
            <Text className="px-5 pb-2 text-lg font-semibold text-gray-900">
              {picker === "course" ? "Select your course" : "Select your year"}
            </Text>
            <ScrollView>
              {pickerOptions.map((opt) => {
                const selected = currentValue === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    className="flex-row items-center justify-between px-5 py-4 active:bg-gray-50"
                    onPress={() => choose(opt.value)}
                  >
                    <Text className={`flex-1 pr-3 text-base ${selected ? "font-semibold text-astra-primary" : "text-gray-800"}`}>
                      {opt.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={20} color="#04107E" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
