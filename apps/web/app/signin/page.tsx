"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AstraLogo } from "@/app/_ui/logo";
import { Button } from "@/app/_ui/button";

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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="astra-fade-up w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-astra-light text-astra-primary">
            <AstraLogo size={34} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-astra-primary">ASTRA Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {step === "email"
              ? "Sign in with your @studbocconi.it email."
              : `Enter the 6-digit code sent to ${email}.`}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {step === "email" ? (
            <input
              className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-astra-accent"
              type="email"
              autoComplete="email"
              placeholder="name@studbocconi.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && email && sendCode()}
            />
          ) : (
            <input
              className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-center text-lg tracking-[8px] outline-none transition-colors focus:border-astra-accent"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={loading}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && otp.length >= 4 && verify()}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            block
            disabled={loading || (step === "email" ? !email : otp.length < 4)}
            onClick={step === "email" ? sendCode : verify}
          >
            {loading ? "…" : step === "email" ? "Send code" : "Verify & continue"}
          </Button>

          {step === "code" && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
