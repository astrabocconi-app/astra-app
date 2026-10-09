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
  TicketLinkResponse,
  UpdateMeInput,
  GuidesResponse,
  AcademicCatalogueResponse,
  AcademicCourseSearchResponse,
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
  /**
   * Called when the server rejects the token we sent (401): the session was
   * revoked, the account deleted or the token expired. The app signs out.
   * It receives the token that was rejected, so a late 401 from an earlier
   * session can be told apart from the current one and ignored.
   */
  onUnauthorized?: (sentToken: string) => void;
}

export interface ApiError extends Error {
  /** HTTP status; 0 when no response arrived (timeout, no connection). */
  status: number;
  /** Server error code, or TIMEOUT / NETWORK / BAD_RESPONSE raised by the client. */
  code?: string;
  /** The x-request-id the server stamped on the response, for support and Sentry. */
  requestId?: string;
}

/** Per-call overrides. */
export interface RequestOptions {
  /** Abort after this long. Defaults: 10 s for GET, 20 s for anything that writes. */
  timeoutMs?: number;
}

/** Reads fail fast so a dead connection shows Retry; the screens keep their last data. */
export const GET_TIMEOUT_MS = 10_000;
/** Writes may wait on a cold server or a third party (Eventbrite), and must not be repeated blindly. */
export const WRITE_TIMEOUT_MS = 20_000;

function makeError(
  status: number,
  code: string | undefined,
  message: string,
  requestId?: string,
): ApiError {
  const err = new Error(message) as ApiError;
  err.name = "ApiError";
  err.status = status;
  err.code = code;
  err.requestId = requestId;
  return err;
}

/**
 * True when asking again could succeed: no answer at all, or a server-side
 * failure. A 4xx will not change by repeating the request.
 */
export function isTransientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return true; // not an ApiError: assume a network blip
  return status === 0 || status >= 500;
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, getToken, onUnauthorized } = options;

  async function request<T>(
    path: string,
    init?: RequestInit,
    opts?: RequestOptions,
  ): Promise<{ data: T; res: Response }> {
    const token = getToken?.();
    // fetch never gives up on a stalled connection (campus Wi-Fi handing over to
    // mobile data), which left spinners — and the first-login sheet — stuck for
    // good. Abort after the timeout so callers get an error to retry on.
    const timeoutMs =
      opts?.timeoutMs ?? (!init?.method || init.method === "GET" ? GET_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await fetch(new URL(path, baseUrl), {
        ...init,
        // After the spread: a caller's signal must not switch the timeout off.
        signal: abort.signal,
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
      text = await res.text();
    } catch (e) {
      if (abort.signal.aborted) throw makeError(0, "TIMEOUT", `ASTRA API timed out on ${path}`);
      // fetch rejects with a bare TypeError when there is no connection; give it
      // the same shape as every other failure so callers can branch on status.
      throw makeError(0, "NETWORK", e instanceof Error ? e.message : `Network error on ${path}`);
    } finally {
      clearTimeout(timer);
    }
    const requestId = res.headers.get("x-request-id") ?? undefined;
    // Parsed inside a try: a gateway's HTML 502/429 page must still surface its
    // status, not a SyntaxError that looks like a client bug.
    let body: unknown;
    let parsed = true;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        parsed = false;
      }
    }

    if (!res.ok) {
      // Only when we actually sent a token: a 401 on the sign-in calls
      // themselves (no token yet) is just a wrong code or password.
      if (res.status === 401 && token) onUnauthorized?.(token);
      const b = (parsed ? body : undefined) as
        { error?: { code?: string; message?: string }; message?: string } | undefined;
      const message = b?.error?.message ?? b?.message ?? `ASTRA API ${res.status} on ${path}`;
      throw makeError(res.status, b?.error?.code, message, requestId);
    }
    if (!parsed) throw makeError(res.status, "BAD_RESPONSE", `ASTRA API sent non-JSON on ${path}`, requestId);
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
    /** PATCH /api/me — name and/or avatar. */
    updateMe: async (input: UpdateMeInput) =>
      (await request<MeResponse>("/api/me", { method: "PATCH", body: JSON.stringify(input) })).data,

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
      /**
       * Official courses; `q` matches code or title.
       * Defaults to the student's own programme — pass `all` for electives and
       * exchange courses from anywhere in the catalogue.
       */
      courses: async (params: { q?: string; programmeId?: string; all?: boolean } = {}) => {
        const qs = new URLSearchParams(
          Object.entries({ ...params, all: params.all ? "1" : "" }).filter(
            ([, v]) => v
          ) as [string, string][]
        ).toString();
        return (
          await request<AcademicCourseSearchResponse>(
            `/api/academic/courses${qs ? `?${qs}` : ""}`
          )
        ).data;
      },
    },

    points: {
      /** GET /api/points/balance — current spendable balance. */
      balance: async () => (await request<PointsBalanceResponse>("/api/points/balance")).data,
      /**
       * GET /api/points/history — ledger entries, newest first. Pass the previous
       * response's `nextCursor` as `cursor` to load older ones.
       */
      history: async (opts?: { cursor?: string | null; limit?: number }) => {
        const qs = new URLSearchParams();
        if (opts?.cursor) qs.set("cursor", opts.cursor);
        if (opts?.limit) qs.set("limit", String(opts.limit));
        const q = qs.toString();
        return (await request<PointsHistoryResponse>(`/api/points/history${q ? `?${q}` : ""}`)).data;
      },
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
      /** The ticket link for this student, with their in-app discount code if any. */
      ticketLink: async (id: string) =>
        (
          await request<TicketLinkResponse>(
            `/api/events/${id}/ticket-link`,
            { method: "POST" },
            // Eventbrite is on the other end of this one; give it the full write budget.
            { timeoutMs: WRITE_TIMEOUT_MS },
          )
        ).data,
    },

    rewards: {
      /** GET /api/rewards — active rewards catalog. */
      list: async () => (await request<RewardListResponse>("/api/rewards")).data,
      /**
       * POST /api/rewards/:id/redeem — spend points on a reward. Returns a
       * single-use voucher when the reward has a code pool, otherwise a
       * pending claim for staff to fulfil.
       */
      redeem: async (rewardId: string, idempotencyKey?: string) =>
        (
          await request<{
            redemptionId: string;
            code: string | null;
            status: "PENDING" | "FULFILLED" | "CANCELLED";
            costPoints: number;
            balance: number;
          }>(`/api/rewards/${rewardId}/redeem`, {
            method: "POST",
            // The server may ignore it today; sending it means a retry after a
            // timeout can be recognised as the same purchase once it doesn't.
            headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
          })
        ).data,
      /** GET /api/me/redemptions — the student's own vouchers. */
      redemptions: async (opts?: { cursor?: string | null }) =>
        (
          await request<{
            /** Pass as `cursor` for older vouchers; null at the end. */
            nextCursor?: string | null;
            items: {
              id: string;
              pickupRef: string;
              rewardId: string;
              rewardTitle: string;
              costPoints: number;
              status: "PENDING" | "FULFILLED" | "CANCELLED";
              code: string | null;
              createdAt: string;
            }[];
          }>(`/api/me/redemptions${opts?.cursor ? `?cursor=${encodeURIComponent(opts.cursor)}` : ""}`)
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

    /** GET /api/guides — ASTRA guides grouped by category. */
    guides: {
      list: async () => (await request<GuidesResponse>("/api/guides")).data,
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
      /**
       * DELETE /api/push/register — detach this device's token from the account
       * before signing out, so the next person on the phone doesn't get the
       * previous student's notifications. Short timeout: sign-out must not hang.
       */
      unregister: async (token: string) =>
        (
          await request<{ ok: boolean }>(
            "/api/push/register",
            { method: "DELETE", body: JSON.stringify({ token }) },
            { timeoutMs: 4_000 },
          )
        ).data,
    },

    classrooms: {
      /**
       * GET /api/classrooms — free classrooms, computed from Bocconi's own
       * room-assignment page. `day` is today | tomorrow | day-after (older app
       * versions); `date` (YYYY-MM-DD) wins when both are given.
       */
      list: async (params?: { time?: string; day?: string; date?: string }) => {
        const qs = new URLSearchParams();
        if (params?.time) qs.set("time", params.time);
        if (params?.day) qs.set("day", params.day);
        if (params?.date) qs.set("date", params.date);
        const q = qs.toString();
        return (
          await request<{
            rooms: {
              name: string;
              building: string;
              floor?: string | null;
              status: "free" | "occupied";
              /** Free: when the next slot starts; absent = free for the rest of the day. */
              freeUntil?: string;
              /** Free inside an open "Aule studio" slot. */
              isStudyRoom?: boolean;
              studyUntil?: string;
              /** Occupied: when the current run of slots ends. */
              occupiedUntil?: string;
            }[];
            freeRooms: number;
            totalRooms: number;
            timestamp: string | null;
            /** The day (YYYY-MM-DD) and time (HH:MM) the answer is for, in Rome time. */
            date?: string;
            time?: string;
            /** False when only the rooms seen on this day could be listed. */
            complete?: boolean;
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
