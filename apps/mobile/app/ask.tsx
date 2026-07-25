import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";

type Source = {
  url: string;
  title?: string | null;
  sourceType?: string | null;
  page?: number | null;
  similarity: number;
};
type Msg = { role: "user" | "assistant"; text: string; sources?: Source[] };

const SOURCE_LABELS: Record<string, string> = {
  guide: "Guide",
  faq: "FAQ",
  handout: "Handout",
  about: "About ASTRA",
  web: "Web",
};
function sourceLabel(s: Source): string {
  const label = s.sourceType ? SOURCE_LABELS[s.sourceType] : undefined;
  return label ?? hostOf(s.url);
}

const SUGGESTIONS = [
  "How do I find a free classroom?",
  "When does the term start?",
  "What student services are on campus?",
];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function AskScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await api.chat.ask(q);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, sources: res.sources }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-2 border-b border-gray-100 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#04107E" />
        </Pressable>
        <View>
          <Text className="text-lg font-semibold text-astra-primary">Ask ASTRA</Text>
          <Text className="text-xs text-gray-400">Answers about Bocconi & ASTRA</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
          {messages.length === 0 && (
            <View className="mt-8 items-center gap-4 px-4">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-astra-light">
                <Ionicons name="sparkles" size={30} color="#04107E" />
              </View>
              <Text className="text-center text-lg font-semibold text-gray-900">
                Ask us anything
              </Text>
              <Text className="text-center text-sm text-gray-500">
                ASTRA is here for you. Ask about campus, programs, services and more.
              </Text>
              <View className="mt-2 w-full gap-2">
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => send(s)}
                    className="rounded-xl border border-gray-200 px-4 py-3 active:bg-gray-50"
                  >
                    <Text className="text-sm text-gray-700">{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((m, i) => (
            <View key={i} className={m.role === "user" ? "items-end" : "items-start"}>
              <View
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  m.role === "user" ? "bg-astra-primary" : "border border-gray-100 bg-gray-50"
                }`}
              >
                <Text className={m.role === "user" ? "text-white" : "text-gray-900"}>{m.text}</Text>
              </View>
              {m.sources && m.sources.length > 0 && (
                <View className="mt-2 w-full max-w-[92%] gap-1">
                  <Text className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Sources
                  </Text>
                  {m.sources.map((s, idx) => (
                    <Pressable
                      key={`${idx}-${s.url}`}
                      onPress={() => Linking.openURL(s.url)}
                      className="flex-row items-center gap-2 rounded-xl bg-astra-light px-3 py-2 active:opacity-70"
                    >
                      <Text className="text-[11px] font-bold text-astra-primary">{idx + 1}</Text>
                      <View className="flex-1">
                        <Text numberOfLines={1} className="text-[12px] font-medium text-astra-primary">
                          {s.title || hostOf(s.url)}
                        </Text>
                        <Text className="text-[10px] text-gray-400">
                          {sourceLabel(s)}
                          {s.page ? ` · p.${s.page}` : ""}
                        </Text>
                      </View>
                      <Ionicons name="open-outline" size={14} color="#04107E" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View className="items-start">
              <View className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <ActivityIndicator color="#04107E" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View className="flex-row items-end gap-2 border-t border-gray-100 px-3 py-2">
          <TextInput
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-base"
            placeholder="Ask a question…"
            value={input}
            onChangeText={setInput}
            multiline
            editable={!loading}
            onSubmitEditing={() => send(input)}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={loading || !input.trim()}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: loading || !input.trim() ? "#A9B0D8" : "#04107E" }}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
