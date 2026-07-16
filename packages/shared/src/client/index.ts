import type { MeResponse } from "../schemas";

// Typed API client used by the mobile app to call apps/web's /api/* routes.
// Mobile NEVER touches the DB — this HTTPS client is its only data path.
//
// Auth model: email-OTP via Better Auth, Bearer tokens (not cookies).
//   1. auth.sendOtp(email)         → server emails / logs a 6-digit code
//   2. auth.verifyOtp(email, otp)  → returns { token, user }; caller persists
//                                     the token (e.g. SecureStore)
//   3. getToken() supplies that token as `Authorization: Bearer <token>` on
//      every subsequent request (e.g. me()).

export interface ApiClientOptions {
  /** Base URL of the deployed apps/web instance, e.g. https://astra.example.com */
  baseUrl: string;
  /** Supplies the persisted session token, if any. */
  getToken?: () => string | null | undefined;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
}

function makeError(status: number, code: string | undefined, message: string): ApiError {
  const err = new Error(message) as ApiError;
  err.name = "ApiError";
  err.status = status;
  err.code = code;
  return err;
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, getToken } = options;

  async function request<T>(
    path: string,
    init?: RequestInit
  ): Promise<{ data: T; res: Response }> {
    const token = getToken?.();
    const res = await fetch(new URL(path, baseUrl), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    const text = await res.text();
    const body = text ? (JSON.parse(text) as unknown) : undefined;

    if (!res.ok) {
      const b = body as
        | { error?: { code?: string; message?: string }; message?: string }
        | undefined;
      const message =
        b?.error?.message ?? b?.message ?? `ASTRA API ${res.status} on ${path}`;
      throw makeError(res.status, b?.error?.code, message);
    }
    return { data: body as T, res };
  }

  return {
    /** GET /api/health — liveness + DB connectivity check. */
    health: async () =>
      (await request<{ status: string; db: string }>("/api/health")).data,

    /** GET /api/me — the authenticated student's profile. */
    me: async () => (await request<MeResponse>("/api/me")).data,

    auth: {
      /** Request a 6-digit sign-in code by email. */
      sendOtp: async (email: string) => {
        await request("/api/auth/email-otp/send-verification-otp", {
          method: "POST",
          body: JSON.stringify({ email, type: "sign-in" }),
        });
        return { ok: true as const };
      },

      /** Verify the code and start a session. Returns the Bearer token to persist. */
      verifyOtp: async (email: string, otp: string) => {
        const { data, res } = await request<{ token?: string; user?: MeResponse }>(
          "/api/auth/sign-in/email-otp",
          { method: "POST", body: JSON.stringify({ email, otp }) }
        );
        // Bearer plugin returns the token in the `set-auth-token` header; the
        // body also carries it for email-otp sign-in. Prefer the header.
        const token = res.headers.get("set-auth-token") ?? data?.token ?? null;
        return { token, user: data?.user ?? null };
      },

      /** DEV-ONLY bypass: sign in by username, no OTP. Server rejects in prod. */
      devLogin: async (username: string) => {
        const { data, res } = await request<{ token?: string; user?: MeResponse }>(
          "/api/auth/dev-login",
          { method: "POST", body: JSON.stringify({ username }) }
        );
        const token = res.headers.get("set-auth-token") ?? data?.token ?? null;
        return { token, user: data?.user ?? null };
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
