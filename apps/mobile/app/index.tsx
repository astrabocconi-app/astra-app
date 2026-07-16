import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "../lib/api";
import { setToken } from "../lib/session";

// Email-OTP login against apps/web (Better Auth):
//   1. sendOtp(email)          — server validates @studbocconi.it, emails a code
//   2. verifyOtp(email, code)  — returns a Bearer token, persisted to SecureStore
type Step = "email" | "code";

export default function LoginScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setLoading(true);
    setError(null);
    try {
      await api.auth.sendOtp(email.trim());
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.auth.verifyOtp(email.trim(), code.trim());
      if (!token) throw new Error("No session token returned.");
      await setToken(token);
      router.replace("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="text-3xl font-bold text-astra-primary">ASTRA</Text>
        <Text className="text-sm text-gray-500">
          {step === "email"
            ? "Sign in with your @studbocconi.it email."
            : `Enter the 6-digit code we sent to ${email}.`}
        </Text>

        {step === "email" ? (
          <TextInput
            className="rounded-lg border border-gray-300 px-3 py-3"
            placeholder="name@studbocconi.it"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        ) : (
          <TextInput
            className="rounded-lg border border-gray-300 px-3 py-3 text-center text-xl tracking-[8px]"
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            editable={!loading}
            autoFocus
          />
        )}

        {error && <Text className="text-sm text-red-600">{error}</Text>}

        <Pressable
          className="rounded-lg bg-astra-primary px-4 py-3 active:opacity-80"
          disabled={loading || (step === "email" ? !email : code.length < 4)}
          onPress={step === "email" ? sendCode : verify}
          style={{ opacity: loading || (step === "email" ? !email : code.length < 4) ? 0.5 : 1 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center font-medium text-white">
              {step === "email" ? "Send code" : "Verify & continue"}
            </Text>
          )}
        </Pressable>

        {step === "code" && !loading && (
          <Pressable onPress={() => { setStep("email"); setCode(""); setError(null); }}>
            <Text className="text-center text-sm text-gray-500">Use a different email</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
