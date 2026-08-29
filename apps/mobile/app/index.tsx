import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  ImageBackground,
  Keyboard,
  ScrollView,
  InputAccessoryView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { isAllowedEmail, isDevLoginUsername, ALLOWED_EMAIL_DOMAINS } from "@astra/shared";
import { api } from "../lib/api";
import { setToken, setAccountType, setPartnerScanOnly } from "../lib/session";
import { registerForPush } from "../lib/push";
import { useBootStore } from "../lib/boot-store";
import { useT } from "../lib/i18n";

// Student: play the logo-morph intro overlay over home, then navigate there.
async function enterStudentApp() {
  await setAccountType("student");
  useBootStore.getState().trigger();
  router.replace("/home");
  void registerForPush();
}

// Login against apps/web (Better Auth). Two modes:
//   • Student — email-OTP (@studbocconi.it) → tabbed home
//   • Partner — login code + password (issued by ASTRA) → venue home
// iOS-only accessory bar so the numeric OTP keypad can be dismissed.
const OTP_ACCESSORY_ID = "astra-otp-accessory";

type Step = "email" | "code";
type Mode = "student" | "partner";

export default function LoginScreen() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("student");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [partnerPassword, setPartnerPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DEV-ONLY: typing a dev username (in a dev build) bypasses OTP entirely.
  const isDevBypass = __DEV__ && isDevLoginUsername(email);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("email");
    setError(null);
    setCode("");
  }

  async function sendCode() {
    setLoading(true);
    setError(null);
    try {
      if (isDevBypass) {
        const { token } = await api.auth.devLogin(email.trim());
        if (!token) throw new Error(t("login.errorDevLoginFailed"));
        await setToken(token);
        await enterStudentApp();
        return;
      }
      await api.auth.sendOtp(email.trim());
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.errorSendCode"));
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.auth.verifyOtp(email.trim(), code.trim());
      if (!token) throw new Error(t("login.errorNoToken"));
      await setToken(token);
      await enterStudentApp();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.errorInvalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function partnerSignIn() {
    setLoading(true);
    setError(null);
    try {
      const { token, scanOnly } = await api.auth.partnerLogin(
        partnerCode.trim(),
        partnerPassword,
      );
      if (!token) throw new Error(t("login.errorLoginFailed"));
      await setToken(token);
      await setAccountType("partner");
      await setPartnerScanOnly(scanOnly);
      // Scan-only staff have no home screen to land on.
      router.replace(scanOnly ? "/partner/scan" : "/partner/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.errorInvalidCodeOrPassword"));
    } finally {
      setLoading(false);
    }
  }

  const studentDisabled =
    loading ||
    (step === "email" ? !(isAllowedEmail(email) || isDevBypass) : code.length < 4);
  const partnerDisabled = loading || !partnerCode.trim() || partnerPassword.length < 4;

  return (
    <ImageBackground
      // Metro's static asset loading uses CommonJS require.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source={require("../assets/campus.jpg")}
      resizeMode="cover"
      imageStyle={{ opacity: 0.18 }}
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
    >
      <SafeAreaView className="flex-1">
        {/* The keyboard covers the sign-in button and had no way out: no
            return key that dismisses, nothing tappable behind it. Tapping the
            background or dragging the content now closes it. */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          onPress={Keyboard.dismiss}
          accessible={false}
        >
          <Image
            // Metro's static asset loading uses CommonJS require.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../assets/logo-horizontal.png")}
            resizeMode="contain"
            style={{ width: 260, height: 70, marginBottom: 40 }}
          />

          <View className="w-full items-center gap-4" style={{ maxWidth: 360 }}>
            {mode === "student" ? (
              <>
                <Text className="text-center text-sm text-gray-600 dark:text-gray-300">
                  {step === "email"
                    ? t("login.signInWithEmail", {
                        domains: ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(" or "),
                      })
                    : t("login.enterCode", { email })}
                </Text>
                {step === "code" && (
                  <Text className="-mt-2 text-center text-xs text-gray-400 dark:text-white/60">
                    {t("login.checkJunkFolder")}
                  </Text>
                )}

                {step === "email" ? (
                  <TextInput
                    className="w-full rounded-xl border border-gray-300 bg-white dark:bg-astra-primary px-4 py-3 text-center"
                    placeholder="name@studbocconi.it"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="go"
                    onSubmitEditing={() => !studentDisabled && sendCode()}
                    value={email}
                    onChangeText={setEmail}
                    editable={!loading}
                  />
                ) : (
                  <TextInput
                    className="w-full rounded-xl border border-gray-300 bg-white dark:bg-astra-primary px-4 py-3 text-center text-xl tracking-[8px]"
                    placeholder="000000"
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                    editable={!loading}
                    autoFocus
                    // A number pad has no return key, so iOS needs an explicit
                    // way to dismiss it.
                    inputAccessoryViewID={OTP_ACCESSORY_ID}
                  />
                )}

                {error && <Text className="text-center text-sm text-red-600">{error}</Text>}

                <Pressable
                  className="w-full items-center rounded-xl px-4 py-3"
                  disabled={studentDisabled}
                  onPress={step === "email" ? sendCode : verify}
                  style={{ backgroundColor: studentDisabled ? "#A9B0D8" : "#04107E" }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-center font-semibold text-white">
                      {step === "email"
                        ? isDevBypass
                          ? t("login.devSignIn")
                          : t("login.sendCode")
                        : t("login.verifyContinue")}
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
                    <Text className="text-center text-sm text-gray-500 dark:text-gray-300">{t("login.useDifferentEmail")}</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Text className="text-center text-sm text-gray-600 dark:text-gray-300">
                  {t("login.partnerSignInDesc")}
                </Text>

                <TextInput
                  className="w-full rounded-xl border border-gray-300 bg-white dark:bg-astra-primary px-4 py-3 text-center"
                  placeholder={t("login.venueCodePlaceholder")}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={partnerCode}
                  onChangeText={setPartnerCode}
                  editable={!loading}
                />
                <TextInput
                  className="w-full rounded-xl border border-gray-300 bg-white dark:bg-astra-primary px-4 py-3 text-center"
                  placeholder={t("login.passwordPlaceholder")}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => !partnerDisabled && partnerSignIn()}
                  value={partnerPassword}
                  onChangeText={setPartnerPassword}
                  editable={!loading}
                />

                {error && <Text className="text-center text-sm text-red-600">{error}</Text>}

                <Pressable
                  className="w-full items-center rounded-xl px-4 py-3"
                  disabled={partnerDisabled}
                  onPress={partnerSignIn}
                  style={{ backgroundColor: partnerDisabled ? "#A9B0D8" : "#04107E" }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-center font-semibold text-white">{t("login.partnerSignIn")}</Text>
                  )}
                </Pressable>
              </>
            )}

            {/* Mode toggle */}
            {!loading && (
              <Pressable
                className="mt-2"
                onPress={() => switchMode(mode === "student" ? "partner" : "student")}
              >
                <Text className="text-center text-sm font-medium text-astra-primary dark:text-white">
                  {mode === "student" ? t("login.imPartner") : t("login.backToStudent")}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
        </ScrollView>

        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID={OTP_ACCESSORY_ID}>
            <View className="flex-row justify-end border-t border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-white/5 px-4 py-2">
              <Pressable onPress={Keyboard.dismiss} hitSlop={8}>
                <Text className="text-base font-semibold text-astra-primary dark:text-white">
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}
