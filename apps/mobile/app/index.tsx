import { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  InputAccessoryView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused } from "expo-router";
import { isAllowedEmail, isDevLoginUsername, ALLOWED_EMAIL_DOMAINS } from "@astra/shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/query-client";
import { APP_ENV } from "../lib/config";
import {
  setToken,
  setAccountType,
  setPartnerScanOnly,
  setUserId,
  getPartnerScanOnly,
} from "../lib/session";
import { useAuthStore } from "../lib/auth-store";
import { useBootStore } from "../lib/boot-store";
import { useEggStore } from "../lib/egg-store";
import { useT, type TranslationKey } from "../lib/i18n";
import { errorKind } from "../lib/api-errors";
import { announce } from "../lib/use-reduced-motion";
import { IMAGES } from "../lib/assets";
import { Text } from "../components/AppText";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

// Login against apps/web (Better Auth). Two modes:
//   • Student — email-OTP (@studbocconi.it) → tabbed home
//   • Partner — login code + password (issued by ASTRA) → venue home
// iOS-only accessory bar so the numeric OTP keypad can be dismissed.
const OTP_ACCESSORY_ID = "astra-otp-accessory";
/** How long "Resend code" stays disabled after a code goes out. */
const RESEND_AFTER_MS = 30_000;

type Step = "email" | "code" | "name";
type Mode = "student" | "partner";

/** What went wrong, in words a student can act on. `fallback` is the case's own generic message. */
function messageFor(error: unknown, fallback: TranslationKey): TranslationKey {
  const kind = errorKind(error);
  if (kind === "rateLimited") return "login.errorRateLimited";
  if (kind === "network" || kind === "timeout") return "login.errorNetwork";
  if (kind === "server") return "login.errorServer";
  return fallback;
}

export default function LoginScreen() {
  const t = useT();
  // Inverted mode survives sign-out, so the login screen honours it too.
  const inverted = useEggStore((s) => s.inverted);
  const signedIn = useAuthStore((s) => s.signedIn);
  const accountType = useAuthStore((s) => s.accountType);
  const focused = useIsFocused();
  const [mode, setMode] = useState<Mode>("student");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [partnerPassword, setPartnerPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [resendReady, setResendReady] = useState(false);

  // A session (restored at boot, or just created below) leaves this screen. The
  // screen does the navigating, once the router has the protected screens, which
  // it only has after the auth store says we are signed in.
  const left = useRef(false);
  useEffect(() => {
    if (!signedIn || !accountType) {
      left.current = false;
      return;
    }
    if (!focused || left.current) return;
    left.current = true;
    if (accountType === "partner") {
      // Scan-only staff have no home screen — go straight to the scanner.
      router.replace(getPartnerScanOnly() ? "/partner/scan" : "/partner/home");
    } else {
      useBootStore.getState().trigger();
      router.replace("/home");
    }
  }, [signedIn, accountType, focused]);

  useEffect(() => {
    if (!sentAt) return;
    const timer = setTimeout(() => setResendReady(true), RESEND_AFTER_MS);
    return () => clearTimeout(timer);
  }, [sentAt]);

  // Spoken as well as shown: a wrong code is otherwise only visible.
  useEffect(() => {
    if (error) announce(error);
  }, [error]);

  // DEV-ONLY: typing a dev username (in a development build) bypasses OTP entirely.
  const isDevBypass = __DEV__ && APP_ENV === "development" && isDevLoginUsername(email);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("email");
    setError(null);
    setCode("");
  }

  /** Start the student session; the effect above does the navigating. */
  async function enterStudentApp() {
    await setAccountType("student");
    useAuthStore.getState().enter("student");
  }

  async function sendCode() {
    setLoading(true);
    setError(null);
    try {
      if (__DEV__ && isDevBypass) {
        // Required here so release bundles never contain the dev-login code.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { devLogin } = require("../lib/dev-login") as typeof import("../lib/dev-login");
        const token = await devLogin(email.trim());
        if (!token) throw new Error(t("login.errorDevLoginFailed"));
        await setToken(token);
        await enterStudentApp();
        return;
      }
      await api.auth.sendOtp(email.trim());
      setResendReady(false);
      setSentAt(Date.now());
      setStep("code");
    } catch (e) {
      setError(t(messageFor(e, "login.errorSendCode")));
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    setError(null);
    try {
      const { token, user } = await api.auth.verifyOtp(email.trim(), code.trim());
      if (!token) throw new Error(t("login.errorNoToken"));
      await setToken(token);
      await setAccountType("student");
      if (user?.id) void setUserId(user.id).catch(() => {});
      // Ask for a name only when the account has none: a returning student who
      // reinstalls is not made to retype it (nor is theirs overwritten).
      let needsName = false;
      try {
        const me = await api.me();
        queryClient.setQueryData(["me"], me);
        if (!user?.id) void setUserId(me.id).catch(() => {});
        needsName = !me.name?.trim();
      } catch {
        // Offline right after sign-in: go in, Profile has "Add your name".
      }
      if (needsName) setStep("name");
      else await enterStudentApp();
    } catch (e) {
      setError(t(messageFor(e, "login.errorInvalidCode")));
    } finally {
      setLoading(false);
    }
  }

  /** Save the name in the background and go in; a failed save is retried from Profile. */
  async function finishName(skip: boolean) {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!skip && first && last) {
      void api
        .updateMe({ firstName: first, lastName: last })
        .then(() => queryClient.invalidateQueries({ queryKey: ["me"] }))
        .catch(() => useAuthStore.getState().setPendingName({ firstName: first, lastName: last }));
    }
    await enterStudentApp();
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
      useAuthStore.getState().enter("partner");
    } catch (e) {
      setError(t(messageFor(e, "login.errorInvalidCodeOrPassword")));
    } finally {
      setLoading(false);
    }
  }

  const studentDisabled =
    loading ||
    (step === "email"
      ? !(isDevBypass || isAllowedEmail(email))
      : step === "code"
        ? code.length < 4
        : !(firstName.trim() && lastName.trim()));
  const partnerDisabled = loading || !partnerCode.trim() || partnerPassword.length < 4;

  const background = { flex: 1, backgroundColor: inverted ? "#04107E" : "#FFFFFF" } as const;

  // Signed in already (restored at boot): nothing to show while the redirect happens.
  if (signedIn && accountType && !loading) return <View style={background} />;

  const field =
    "w-full rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-astra-primary px-4 py-3 text-center text-gray-900 dark:text-white";

  return (
    <ImageBackground
      source={IMAGES.campus}
      resizeMode="cover"
      imageStyle={{ opacity: 0.18 }}
      style={background}
    >
      <SafeAreaView className="flex-1">
        {/* iOS keeps the Send/Verify button above the keyboard through the
            ScrollView's own inset; Android windows are edge to edge and are not
            resized, so they need the padding. */}
        <KeyboardAvoidingView behavior="padding" enabled={Platform.OS !== "ios"} style={{ flex: 1 }}>
          {/* The keyboard covers the sign-in button and had no way out: no
              return key that dismisses, nothing tappable behind it. Tapping the
              background or dragging the content now closes it. */}
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              className="flex-1 items-center justify-center px-8 py-6"
              onPress={Keyboard.dismiss}
              accessible={false}
            >
              <Image
                source={inverted ? IMAGES.logoHorizontalWhite : IMAGES.logoHorizontal}
                resizeMode="contain"
                style={{ width: 260, height: 70, marginBottom: 40 }}
                accessibilityLabel="ASTRA"
                accessibilityIgnoresInvertColors
              />

              <View className="w-full items-center gap-4" style={{ maxWidth: 360 }}>
                {mode === "student" ? (
                  <>
                    <Text className="text-center text-sm text-gray-700 dark:text-gray-200">
                      {step === "email"
                        ? t("login.signInWithEmail", {
                            domains: ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(` ${t("common.or")} `),
                          })
                        : step === "code"
                          ? t("login.enterCode", { email })
                          : t("login.nameBody")}
                    </Text>
                    {step === "code" && (
                      <Text className="-mt-2 text-center text-xs text-gray-600 dark:text-white/70">
                        {t("login.checkJunkFolder")}
                      </Text>
                    )}

                    {step === "name" && (
                      <View className="w-full gap-3">
                        {[
                          { value: firstName, set: setFirstName, label: t("login.firstName"), type: "givenName" as const, auto: "name-given" as const },
                          { value: lastName, set: setLastName, label: t("login.lastName"), type: "familyName" as const, auto: "name-family" as const },
                        ].map((f) => (
                          <TextField
                            key={f.label}
                            center
                            className={field}
                            placeholderTextColor="#6B7280"
                            placeholder={f.label}
                            accessibilityLabel={f.label}
                            autoCapitalize="words"
                            autoCorrect={false}
                            textContentType={f.type}
                            autoComplete={f.auto}
                            maxLength={40}
                            value={f.value}
                            onChangeText={f.set}
                          />
                        ))}
                      </View>
                    )}
                    {step === "email" ? (
                      <TextField
                        center
                        className={field}
                        placeholderTextColor="#6B7280"
                        placeholder="name@studbocconi.it"
                        accessibilityLabel={t("login.emailLabel")}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        returnKeyType="go"
                        onSubmitEditing={() => !studentDisabled && sendCode()}
                        value={email}
                        onChangeText={setEmail}
                        editable={!loading}
                      />
                    ) : step === "code" ? (
                      <TextInput
                        className="w-full rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-astra-primary px-4 py-3 text-center text-xl tracking-[8px] text-gray-900 dark:text-white"
                        placeholderTextColor="#6B7280"
                        placeholder="000000"
                        accessibilityLabel={t("login.codeLabel")}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        maxLength={6}
                        maxFontSizeMultiplier={1.4}
                        value={code}
                        onChangeText={setCode}
                        editable={!loading}
                        autoFocus
                        // A number pad has no return key, so iOS needs an explicit
                        // way to dismiss it.
                        inputAccessoryViewID={OTP_ACCESSORY_ID}
                      />
                    ) : null}

                    {error && (
                      <Text
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                        className="text-center text-sm text-red-700 dark:text-red-300"
                      >
                        {error}
                      </Text>
                    )}

                    <Button
                      label={
                        step === "email"
                          ? isDevBypass
                            ? t("login.devSignIn")
                            : t("login.sendCode")
                          : step === "code"
                            ? t("login.verifyContinue")
                            : t("login.nameContinue")
                      }
                      loading={loading}
                      disabled={studentDisabled}
                      onPress={() => (step === "email" ? sendCode() : step === "code" ? verify() : finishName(false))}
                    />

                    {step === "name" && (
                      <Pressable
                        onPress={() => finishName(true)}
                        className="min-h-[44px] justify-center py-2"
                        hitSlop={8}
                        accessibilityRole="button"
                      >
                        <Text chrome className="text-center text-sm text-gray-700 dark:text-gray-200">
                          {t("login.nameLater")}
                        </Text>
                      </Pressable>
                    )}

                    {step === "code" && !loading && (
                      <View className="items-center">
                        {/* Re-sends to the same address; held back briefly so a
                            slow inbox doesn't trigger a pile of codes. */}
                        <Pressable
                          onPress={sendCode}
                          disabled={!resendReady}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: !resendReady }}
                          className={`min-h-[44px] justify-center py-2 ${resendReady ? "" : "opacity-40"}`}
                          hitSlop={8}
                        >
                          <Text chrome className="text-center text-sm font-medium text-astra-primary dark:text-white">
                            {t("login.resendCode")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setStep("email");
                            setCode("");
                            setError(null);
                          }}
                          accessibilityRole="button"
                          className="min-h-[44px] justify-center py-2"
                          hitSlop={8}
                        >
                          <Text chrome className="text-center text-sm text-gray-600 dark:text-gray-300">
                            {t("login.useDifferentEmail")}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text className="text-center text-sm text-gray-700 dark:text-gray-200">
                      {t("login.partnerSignInDesc")}
                    </Text>

                    <TextField
                      center
                      className={field}
                      placeholderTextColor="#6B7280"
                      placeholder={t("login.venueCodePlaceholder")}
                      accessibilityLabel={t("login.venueCodePlaceholder")}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={partnerCode}
                      onChangeText={setPartnerCode}
                      editable={!loading}
                    />
                    <TextField
                      center
                      className={field}
                      placeholderTextColor="#6B7280"
                      placeholder={t("login.passwordPlaceholder")}
                      accessibilityLabel={t("login.passwordPlaceholder")}
                      secureTextEntry
                      textContentType="password"
                      autoComplete="password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={() => !partnerDisabled && partnerSignIn()}
                      value={partnerPassword}
                      onChangeText={setPartnerPassword}
                      editable={!loading}
                    />

                    {error && (
                      <Text
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                        className="text-center text-sm text-red-700 dark:text-red-300"
                      >
                        {error}
                      </Text>
                    )}

                    <Button
                      label={t("login.partnerSignIn")}
                      loading={loading}
                      disabled={partnerDisabled}
                      onPress={partnerSignIn}
                    />
                  </>
                )}

                {/* Mode toggle */}
                {!loading && step !== "name" && (
                  <Pressable
                    className="mt-2 min-h-[44px] justify-center py-2"
                    hitSlop={8}
                    accessibilityRole="button"
                    onPress={() => switchMode(mode === "student" ? "partner" : "student")}
                  >
                    <Text chrome className="text-center text-sm font-medium text-astra-primary dark:text-white">
                      {mode === "student" ? t("login.imPartner") : t("login.backToStudent")}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID={OTP_ACCESSORY_ID}>
            <View className="flex-row justify-end border-t border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-astra-dark px-4 py-2">
              <Pressable onPress={Keyboard.dismiss} hitSlop={8} accessibilityRole="button" className="min-h-[44px] justify-center">
                <Text chrome className="text-base font-semibold text-astra-primary dark:text-white">
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
