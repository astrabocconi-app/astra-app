import { API_URL } from "./config";

/**
 * DEV-ONLY sign-in by username, no OTP (the server refuses it in production).
 * Lives here, not in the shared client, and is only ever require()d behind
 * `__DEV__`, so release bundles carry neither the endpoint nor this code.
 */
export async function devLogin(username: string): Promise<string | null> {
  const res = await fetch(new URL("/api/auth/dev-login", API_URL), {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { token?: string } | null;
  return res.headers.get("set-auth-token") ?? body?.token ?? null;
}
