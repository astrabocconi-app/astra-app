import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

// OTP login — SKELETON.
// TODO(US-001): implement the real Better Auth email-OTP flow against apps/web:
//   1. POST /api/auth/otp/send { email }  (server validates @studbocconi.it)
//   2. user enters the 6-digit code
//   3. POST /api/auth/otp/verify { email, code } → session token (SecureStore)
// For now the button just navigates to the home screen so the shell is testable.
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="text-2xl font-semibold text-astra-primary">ASTRA</Text>
        <Text className="text-sm text-gray-500">
          Sign in with your @studbocconi.it email. (Scaffold — OTP flow not wired yet.)
        </Text>

        <TextInput
          className="rounded-lg border border-gray-300 px-3 py-3"
          placeholder="name@studbocconi.it"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {sent && (
          <TextInput
            className="rounded-lg border border-gray-300 px-3 py-3"
            placeholder="6-digit code"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
        )}

        <Pressable
          className="rounded-lg bg-astra-primary px-4 py-3"
          onPress={() => (sent ? router.replace("/home") : setSent(true))}
        >
          <Text className="text-center font-medium text-white">
            {sent ? "Verify & continue" : "Send code"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
