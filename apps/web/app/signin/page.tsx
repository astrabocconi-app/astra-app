"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Minimal email-OTP sign-in for the dashboard. Only @studbocconi.it is accepted
// (enforced server-side); admins are promoted via SQL after first sign-in.
export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setLoading(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setLoading(false);
    if (error) return setError(error.message ?? "Couldn't send the code.");
    setStep("code");
  }

  async function verify() {
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    setLoading(false);
    if (error) return setError(error.message ?? "Invalid or expired code.");
    router.replace("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold" style={{ color: "#04107E" }}>
        ASTRA Dashboard
      </h1>
      <p className="text-sm text-gray-500">
        {step === "email"
          ? "Sign in with your @studbocconi.it email."
          : `Enter the 6-digit code sent to ${email}.`}
      </p>

      {step === "email" ? (
        <input
          className="rounded-lg border border-gray-300 px-3 py-2"
          type="email"
          autoComplete="email"
          placeholder="name@studbocconi.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      ) : (
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[6px]"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          disabled={loading}
          autoFocus
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        className="rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "#04107E" }}
        disabled={loading || (step === "email" ? !email : otp.length < 4)}
        onClick={step === "email" ? sendCode : verify}
      >
        {loading ? "…" : step === "email" ? "Send code" : "Verify & continue"}
      </button>

      {step === "code" && (
        <button
          className="text-sm text-gray-500"
          onClick={() => {
            setStep("email");
            setOtp("");
            setError(null);
          }}
        >
          Use a different email
        </button>
      )}
    </main>
  );
}
