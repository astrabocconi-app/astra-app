"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AstraLogo } from "@/app/_ui/logo";
import { Button } from "@/app/_ui/button";

// Backoffice sign-in: username + password, for both kinds of account.
//
// The central admin may get a second factor — the response comes back `pending`
// and a 6-digit code is emailed, which the second step verifies. Staff accounts
// created from Team have no mailbox of their own, so the same call signs them
// in directly and there is no second step. The form does not need to know which
// it is talking to: the presence of `pending` decides.
//
// Talks to /api/auth/admin-login and /api/auth/admin-verify.
async function post(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Something went wrong.");
  return data;
}

const inputClass =
  "w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-astra-accent disabled:opacity-50";

export function SignInForm({ next }: { next: string }) {
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
      const res = await post("admin-login", { username, password });
      // 2FA disabled (local/dev): signed in already → go to the dashboard.
      if (!res?.pending) {
        router.replace(next);
        return;
      }
      setSentTo(res.sentTo ?? "");
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
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = step === "credentials" ? Boolean(username && password) : otp.trim().length === 6;

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="astra-fade-up w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-astra-light text-astra-primary">
            <AstraLogo size={34} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-astra-primary">ASTRA Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {step === "credentials"
              ? "For ASTRA staff and admins. Students use the app."
              : `Enter the 6-digit code sent to ${sentTo || "your email"}.`}
          </p>
        </div>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit || loading) return;
            void (step === "credentials" ? submitCredentials() : submitOtp());
          }}
        >
          {step === "credentials" ? (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Username
                <input
                  className={inputClass}
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Password
                <input
                  className={inputClass}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              6-digit code
              <input
                className={`${inputClass} text-center text-lg tracking-[8px]`}
                name="otp"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" block disabled={loading || !canSubmit}>
            {loading
              ? step === "credentials"
                ? "Signing in…"
                : "Checking…"
              : step === "credentials"
                ? "Continue"
                : "Verify & sign in"}
          </Button>

          {step === "otp" && (
            <button
              type="button"
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
        </form>
      </div>
    </main>
  );
}
