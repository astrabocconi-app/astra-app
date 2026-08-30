import type {
  MeResponse,
  PointsBalanceResponse,
  PointsHistoryResponse,
  NewsListResponse,
  EventListResponse,
  RewardListResponse,
  PartnerListResponse,
  ChatResponse,
  MaterialsResponse,
  AcademicCatalogueResponse,
  AcademicProfile,
  AcademicProfileInput,
} from "../schemas";

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

  async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; res: Response }> {
    const token = getToken?.();
    const res = await fetch(new URL(path, baseUrl), {
      ...init,
      // Bearer-only client: never send cookies. A stray session cookie (e.g. one
      // the platform auto-stored from a prior response) would trigger Better
      // Auth's origin check, which fails because RN fetch sends no Origin header.
      credentials: "omit",
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
        { error?: { code?: string; message?: string }; message?: string } | undefined;
      const message = b?.error?.message ?? b?.message ?? `ASTRA API ${res.status} on ${path}`;
      throw makeError(res.status, b?.error?.code, message);
    }
    return { data: body as T, res };
  }

  return {
    /** GET /api/health — liveness + DB connectivity check. */
    health: async () => (await request<{ status: string; db: string }>("/api/health")).data,

    /**
     * GET /api/content/:key — editable screen content.
     *
     * Returns null when nothing is stored or the request fails, so the caller
     * falls back to its bundled copy. A 404 here is the normal "never edited"
     * case, not an error worth surfacing.
     */
    content: async (key: string): Promise<unknown | null> => {
      try {
        const res = await request<{ key: string; data: unknown; updatedAt: string }>(
          `/api/content/${encodeURIComponent(key)}`,
        );
        return res.data.data;
      } catch {
        return null;
      }
    },

    /** GET /api/me — the authenticated student's profile. */
    me: async () => (await request<MeResponse>("/api/me")).data,

    /**
     * POST /api/support — send a question, issue or idea.
     * The sender is taken from the session, so no email field to mistype.
     */
    support: async (body: {
      kind: "QUESTION" | "ISSUE" | "IDEA";
      message: string;
      appVersion?: string | null;
      platform?: string | null;
    }) =>
      (
        await request<{ id: string; createdAt: string }>("/api/support", {
          method: "POST",
          body: JSON.stringify(body),
        })
      ).data,

    /**
     * DELETE /api/me — permanently delete the signed-in account.
     * Irreversible; the caller must clear the local token afterwards.
     */
    deleteAccount: async () =>
      (
        await request<{ deleted: boolean; removed: Record<string, number> }>("/api/me", {
          method: "DELETE",
        })
      ).data,

    academic: {
      /** Public Bocconi selection metadata reviewed for the active academic year. */
      catalogue: async () =>
        (await request<AcademicCatalogueResponse>("/api/academic/catalogue")).data,
      /** The signed-in student's server-authoritative academic selection. */
      profile: async () =>
        (await request<{ profile: AcademicProfile | null }>("/api/me/academic-profile")).data,
      updateProfile: async (input: AcademicProfileInput) =>
        (
          await request<{ profile: AcademicProfile }>("/api/me/academic-profile", {
            method: "PUT",
            body: JSON.stringify(input),
          })
        ).data,
    },

    points: {
      /** GET /api/points/balance — current spendable balance. */
      balance: async () => (await request<PointsBalanceResponse>("/api/points/balance")).data,
      /** GET /api/points/history — recent ledger entries, newest first. */
      history: async () => (await request<PointsHistoryResponse>("/api/points/history")).data,
    },

    card: {
      /** GET /api/card/token — signed token to render in the student's card QR. */
      token: async () => (await request<{ token: string }>("/api/card/token")).data,
    },

    /** GET /api/news — published news posts for the feed. */
    news: {
      list: async () => (await request<NewsListResponse>("/api/news")).data,
    },

    /** GET /api/events — published upcoming events. */
    events: {
      list: async () => (await request<EventListResponse>("/api/events")).data,
    },

    rewards: {
      /** GET /api/rewards — active rewards catalog. */
      list: async () => (await request<RewardListResponse>("/api/rewards")).data,
      /**
       * POST /api/rewards/:id/redeem — spend points on a reward. Returns a
       * single-use voucher when the reward has a code pool, otherwise a
       * pending claim for staff to fulfil.
       */
      redeem: async (rewardId: string) =>
        (
          await request<{
            redemptionId: string;
            code: string | null;
            status: "PENDING" | "FULFILLED" | "CANCELLED";
            costPoints: number;
            balance: number;
          }>(`/api/rewards/${rewardId}/redeem`, { method: "POST" })
        ).data,
      /** GET /api/me/redemptions — the student's own vouchers. */
      redemptions: async () =>
        (
          await request<{
            items: {
              id: string;
              rewardId: string;
              rewardTitle: string;
              costPoints: number;
              status: "PENDING" | "FULFILLED" | "CANCELLED";
              code: string | null;
              createdAt: string;
            }[];
          }>("/api/me/redemptions")
        ).data,
    },

    /** GET /api/partners — active partner venues + their discounts (Discounts screen). */
    partners: {
      list: async () => (await request<PartnerListResponse>("/api/partners")).data,
    },

    /** GET /api/materials — handouts catalogue (year → subject → items). */
    materials: {
      /** `allYears` widens the result from the student's year to their whole programme. */
      list: async (opts?: { allYears?: boolean }) =>
        (
          await request<MaterialsResponse>(
            `/api/materials${opts?.allYears ? "?allYears=1" : ""}`,
          )
        ).data,
    },

    /** Ask ASTRA — RAG chatbot over scraped Bocconi/ASTRA content. */
    chat: {
      ask: async (message: string) =>
        (
          await request<ChatResponse>("/api/chat", {
            method: "POST",
            body: JSON.stringify({ message }),
          })
        ).data,
    },

    /** Push notifications. */
    push: {
      /** Register this device's Expo push token for the signed-in user. */
      register: async (token: string, platform: "IOS" | "ANDROID") =>
        (
          await request<{ ok: boolean }>("/api/push/register", {
            method: "POST",
            body: JSON.stringify({ token, platform }),
          })
        ).data,
    },

    classrooms: {
      /** GET /api/classrooms — live Bocconi free-classroom availability (Free@B). */
      list: async (params?: { time?: string; day?: string }) => {
        const qs = new URLSearchParams();
        if (params?.time) qs.set("time", params.time);
        if (params?.day) qs.set("day", params.day);
        const q = qs.toString();
        return (
          await request<{
            rooms: {
              name: string;
              building: string;
              status: "free" | "occupied";
              freeUntil?: string;
              isStudyRoom?: boolean;
            }[];
            freeRooms: number;
            totalRooms: number;
            timestamp: string | null;
          }>(`/api/classrooms${q ? `?${q}` : ""}`)
        ).data;
      },
    },

    partner: {
      /**
       * POST /api/partner/scan — award points for a scanned student card token.
       * `offerId` records which promotion the scan was for; the server checks
       * it belongs to this venue.
       */
      scan: async (token: string, offerId?: string | null) =>
        (
          await request<{
            awarded: number;
            student: { name: string | null };
            balance: number;
            offer: { id: string; title: string } | null;
          }>("/api/partner/scan", {
            method: "POST",
            body: JSON.stringify({ token, offerId: offerId ?? null }),
          })
        ).data,
      /** GET /api/partner/offers — live promotions, to ask which one a scan is for. */
      offers: async () =>
        (
          await request<{
            partner: { id: string; name: string };
            offers: { id: string; title: string; label: string }[];
          }>("/api/partner/offers")
        ).data,
      /**
       * GET /api/partner/stats — the venue's scan tallies over `days`,
       * bucketed for charting with one series per promotion.
       */
      stats: async (days = 7) =>
        (
          await request<{
            partner: { id: string; name: string };
            range: { days: number; bucket: "day" | "week" };
            buckets: string[];
            series: { offerId: string | null; title: string; counts: number[]; total: number }[];
            scansToday: number;
            scansTotal: number;
            scansInRange: number;
            pointsToday: number;
            perOffer: { offerId: string; title: string; scans: number }[];
            unattributed: number;
          }>(`/api/partner/stats?days=${days}`)
        ).data,
    },

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

      /** Partner venue sign-in: login code + password (issued by ASTRA). */
      partnerLogin: async (code: string, password: string) => {
        const { data, res } = await request<{
          token?: string;
          user?: MeResponse;
          partner?: { id: string; name: string };
          /** Scan-only staff logins never see takings — the API enforces it too. */
          scanOnly?: boolean;
        }>("/api/auth/partner-login", {
          method: "POST",
          body: JSON.stringify({ code, password }),
        });
        const token = res.headers.get("set-auth-token") ?? data?.token ?? null;
        return {
          token,
          user: data?.user ?? null,
          partner: data?.partner ?? null,
          scanOnly: data?.scanOnly ?? false,
        };
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
