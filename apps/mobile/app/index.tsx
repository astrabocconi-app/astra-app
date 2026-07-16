import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  ImageBackground,
} from "react-native";
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

  const disabled = loading || (step === "email" ? !email : code.length < 4);

  return (
    <ImageBackground
      source={require("../assets/campus.jpg")}
      resizeMode="cover"
      imageStyle={{ opacity: 0.18 }}
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
    >
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center px-8">
          {/* Centered brand lockup */}
          <Image
            source={require("../assets/logo-horizontal.png")}
            resizeMode="contain"
            style={{ width: 260, height: 70, marginBottom: 40 }}
          />

          {/* Centered form */}
          <View className="w-full items-center gap-4" style={{ maxWidth: 360 }}>
            <Text className="text-center text-sm text-gray-600">
              {step === "email"
                ? "Sign in with your @studbocconi.it email."
                : `Enter the 6-digit code sent to ${email}.`}
            </Text>

            {step === "email" ? (
              <TextInput
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center"
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
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-xl tracking-[8px]"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                editable={!loading}
                autoFocus
              />
            )}

            {error && <Text className="text-center text-sm text-red-600">{error}</Text>}

            <Pressable
              className="w-full items-center rounded-xl px-4 py-3"
              disabled={disabled}
              onPress={step === "email" ? sendCode : verify}
              // Fully opaque: disabled shows a solid muted blue (not see-through).
              style={{ backgroundColor: disabled ? "#A9B0D8" : "#04107E" }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-center font-semibold text-white">
                  {step === "email" ? "Send code" : "Verify & continue"}
                </Text>
              )}
            </Pressable>

            {step === "code" && !loading && (
              <Pressable
                onPress={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                <Text className="text-center text-sm text-gray-500">Use a different email</Text>
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
