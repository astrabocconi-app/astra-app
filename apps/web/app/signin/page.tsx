"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AstraLogo } from "@/app/_ui/logo";
import { Button } from "@/app/_ui/button";

// ASTRA admin sign-in: username + password, then a 6-digit OTP emailed to the
// admin address (two factors). Talks to the custom Better Auth endpoints
// /api/auth/admin-login and /api/auth/admin-verify.
async function post(path: string, body: unknown) {
  const res = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Something went wrong.");
  return data;
}

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCredentials() {
    setLoading(true);
    setError(null);
    try {
      const { sentTo } = await post("admin-login", { username, password });
      setSentTo(sentTo ?? "");
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp() {
    setLoading(true);
    setError(null);
    try {
      await post("admin-verify", { otp });
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
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
            {step === "credentials"
              ? "Sign in with your admin username and password."
              : `Enter the 6-digit code sent to ${sentTo || "your email"}.`}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {step === "credentials" ? (
            <>
              <input
                className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-astra-accent"
                type="text"
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
              <input
                className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-astra-accent"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => e.key === "Enter" && username && password && submitCredentials()}
              />
            </>
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
              onKeyDown={(e) => e.key === "Enter" && otp.length >= 4 && submitOtp()}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            block
            disabled={
              loading || (step === "credentials" ? !username || !password : otp.length < 4)
            }
            onClick={step === "credentials" ? submitCredentials : submitOtp}
          >
            {loading ? "…" : step === "credentials" ? "Continue" : "Verify & sign in"}
          </Button>

          {step === "otp" && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700"
              onClick={() => {
                setStep("credentials");
                setOtp("");
                setError(null);
              }}
            >
              Back
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
