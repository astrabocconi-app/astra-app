import { z } from "zod";

// Zod schemas are the single source of truth for anything crossing the network
// boundary. TS types are inferred from them (`z.infer<...>`), never duplicated.

/** Payload for POST /api/auth/email-otp/send-verification-otp. */
export const sendOtpInput = z.object({
  email: z.string().email(),
});
export type SendOtpInput = z.infer<typeof sendOtpInput>;

/** Payload for POST /api/auth/sign-in/email-otp. */
export const verifyOtpInput = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpInput>;

// ── Academic profile ────────────────────────────────────────────────────────

export const academicClassGroup = z.object({
  id: z.string(),
  code: z.string(),
  sourceUrl: z.string().url(),
});

export const academicTrack = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  sourceUrl: z.string().url(),
  /** First study year the track can be chosen. */
  fromYear: z.number().int().min(1).default(1),
});

export const academicProgramme = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  level: z.string(),
  durationYears: z.number().int().positive(),
  sourceUrl: z.string().url(),
  legacy: z.boolean(),
  classGroups: z.array(academicClassGroup),
  tracks: z.array(academicTrack),
});

export const academicProfile = z.object({
  programme: academicProgramme.omit({ classGroups: true, tracks: true }),
  catalogue: z.object({
    id: z.string(),
    academicYear: z.string(),
    version: z.string(),
    sourceUrl: z.string().url(),
  }),
  studyYear: z.number().int().min(1).max(5),
  track: academicTrack.nullable(),
  classGroup: academicClassGroup.nullable(),
  updatedAt: z.string(),
});
export type AcademicProfile = z.infer<typeof academicProfile>;

export const academicCatalogueResponse = z.object({
  id: z.string(),
  academicYear: z.string(),
  version: z.string(),
  sourceUrl: z.string().url(),
  programmes: z.array(academicProgramme),
});
export type AcademicCatalogueResponse = z.infer<typeof academicCatalogueResponse>;

export const academicProfileInput = z.object({
  programmeId: z.string().min(1),
  studyYear: z.number().int().min(1).max(5),
  trackId: z.string().min(1).nullable().optional(),
  classGroupId: z.string().min(1).nullable().optional(),
});
export type AcademicProfileInput = z.infer<typeof academicProfileInput>;

// ── Academic courses (official catalogue) ───────────────────────────────────

/** An official course as offered to one programme. */
export const academicCourse = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  language: z.string().nullable(),
  credits: z.number().int().positive(),
  semester: z.string().nullable(),
  courseType: z.string().nullable(),
  sourceUrl: z.string().url(),
});
export type AcademicCourse = z.infer<typeof academicCourse>;

/** GET /api/academic/courses — course picker results. */
export const academicCourseSearchResponse = z.object({
  courses: z.array(academicCourse),
});
export type AcademicCourseSearchResponse = z.infer<typeof academicCourseSearchResponse>;

/** Shape returned by GET /api/me for the authenticated student. */
export const meResponse = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  /** DiceBear seed for the profile picture (see avatar.ts). */
  avatarSeed: z.string(),
  roles: z.array(z.string()),
  academicProfile: academicProfile.nullable(),
});
export type MeResponse = z.infer<typeof meResponse>;

/** PATCH /api/me — the student's own name and avatar. */
export const updateMeInput = z.object({
  firstName: z.string().trim().min(1).max(40).optional(),
  lastName: z.string().trim().min(1).max(40).optional(),
  avatarSeed: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeInput>;

// ── Points ──────────────────────────────────────────────────────────────────

/** GET /api/points/balance — the current user's spendable balance. */
export const pointsBalanceResponse = z.object({
  balance: z.number().int(),
  kind: z.string(),
});
export type PointsBalanceResponse = z.infer<typeof pointsBalanceResponse>;

/** A single append-only ledger entry (read model). */
export const ledgerEntry = z.object({
  id: z.string(),
  delta: z.number().int(), // + earned, − spent
  source: z.string(),
  reason: z.string(),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  createdAt: z.string(), // ISO
});
export type LedgerEntry = z.infer<typeof ledgerEntry>;

/** GET /api/points/history — recent ledger entries, newest first. */
export const pointsHistoryResponse = z.object({
  entries: z.array(ledgerEntry),
  /** Pass back as ?cursor= for the next page; null/absent at the end. Optional so older builds keep parsing. */
  nextCursor: z.string().nullable().optional(),
});
export type PointsHistoryResponse = z.infer<typeof pointsHistoryResponse>;

// ── Content links (news + events) ─────────────────────────────────────────

/**
 * In-app destinations a content link may point at.
 *
 * An allowlist rather than free text: a typo in a route would produce a button
 * that silently does nothing, and the editor picks from this list instead of
 * typing a path. Keep in step with the mobile app's route table.
 */
export const IN_APP_ROUTES = [
  "/rewards",
  "/materials",
  "/classrooms",
  "/discounts",
  "/support",
  "/points-history",
  "/academics",
  "/polare",
] as const;
export type InAppRoute = (typeof IN_APP_ROUTES)[number];

/** A single news post, event or venue page, as opened from a notification tap. */
const IN_APP_ITEM_ROUTE = /^\/(news|event|venue)\/[A-Za-z0-9_-]{1,64}$/;

/**
 * Is this somewhere the app can open? The static list above (what the backoffice
 * picker offers) plus a specific news post, event or venue (what the server puts
 * in a notification about that item). Builds before this existed only know the
 * static list and simply ignore an item route, which is the same as no route.
 */
export function isInAppRoute(route: string): boolean {
  return (IN_APP_ROUTES as readonly string[]).includes(route) || IN_APP_ITEM_ROUTE.test(route);
}

/** Human labels for the backoffice picker. */
export const IN_APP_ROUTE_LABELS: Record<InAppRoute, string> = {
  "/rewards": "Rewards",
  "/materials": "Materials",
  "/classrooms": "Free classrooms",
  "/discounts": "Discounts",
  "/support": "Support",
  "/points-history": "Points history",
  "/academics": "Academics",
  "/polare": "ASTRA Polare",
};

export const contentLink = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("external"),
    label: z.string().trim().min(1, "Give the link a label").max(60),
    // https only: an http link is blocked by App Transport Security anyway, so
    // it would look like a broken button rather than an insecure one.
    value: z.string().trim().url().startsWith("https://", "Links must start with https://"),
  }),
  z.object({
    kind: z.literal("internal"),
    label: z.string().trim().min(1, "Give the link a label").max(60),
    value: z.enum(IN_APP_ROUTES),
  }),
]);
export type ContentLink = z.infer<typeof contentLink>;

/** At most six, so the bottom of an article doesn't turn into a link farm. */
export const contentLinks = z.array(contentLink).max(6).default([]);

// ── CMS: shared field helpers ─────────────────────────────────────────────

/** Optional free text: blank or missing becomes null, never "". */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .nullish()
    .transform((v) => v || null);

/** https only: an http link is blocked by App Transport Security, and javascript:/data: must never reach the app. */
const httpsUrl = z.string().trim().url().startsWith("https://", "Must start with https://");

const optionalUrl = httpsUrl.nullish().or(z.literal("").transform(() => null));

// Image reference: an https URL OR a relative /api/media/:id path (uploads to our
// own store). Empty → null. http:// is refused: iOS would silently not load it.
const optionalImageRef = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || /^\/api\/media\/[A-Za-z0-9_-]+$/.test(v) || /^https:\/\/\S+$/.test(v),
    { message: "Enter an https:// image URL, or upload one" },
  );

/** A date-time WITH its zone offset ("2026-10-10T21:30:00+02:00"). A bare local time would be read as UTC by the server. */
const isoWithOffset = z
  .string()
  .trim()
  .refine((v) => z.iso.datetime({ offset: true }).safeParse(v).success && !Number.isNaN(Date.parse(v)), {
    message: "Enter a valid date and time (with its timezone)",
  });

// ── CMS: News ─────────────────────────────────────────────────────────────
// `imageUrl` is either a pasted absolute URL or a /api/media/:id path for an
// image uploaded to our own store. Empty string → null on the wire.

const newsFields = {
  title: z.string().trim().min(1, "Title is required").max(200, "Must be 200 characters or fewer"),
  body: z.string().trim().min(1, "Body is required").max(20000, "Must be 20,000 characters or fewer"),
  excerpt: optText(240),
  imageUrl: optionalImageRef,
};

/** Admin create payload for a news post. */
export const newsInput = z.object({
  ...newsFields,
  published: z.boolean().default(false),
  pinned: z.boolean().default(false),
  links: contentLinks,
});
export type NewsInput = z.infer<typeof newsInput>;

/**
 * Admin update payload: every field optional, and NO defaults — a partial save
 * that omits `published` must leave it alone, not switch it to false.
 */
export const newsPatchInput = z.object(newsFields).partial().extend({
  published: z.boolean().optional(),
  pinned: z.boolean().optional(),
  links: z.array(contentLink).max(6).optional(),
});

export const newsItem = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  excerpt: z.string().nullable(),
  imageUrl: z.string().nullable(),
  published: z.boolean(),
  pinned: z.boolean(),
  publishedAt: z.string().nullable(),
  links: z.array(contentLink),
  createdAt: z.string(),
});
export type NewsItem = z.infer<typeof newsItem>;

export const newsListResponse = z.object({ items: z.array(newsItem) });
export type NewsListResponse = z.infer<typeof newsListResponse>;

// ── CMS: Events (advertise-only) ────────────────────────────────────────────

const eventFields = {
  title: z.string().trim().min(1, "Title is required").max(200, "Must be 200 characters or fewer"),
  description: optText(5000),
  imageUrl: optionalImageRef,
  location: optText(200),
  startsAt: isoWithOffset,
  endsAt: isoWithOffset.nullish().or(z.literal("").transform(() => null)),
  externalTicketUrl: optionalUrl,
  /** In-app discount: the Eventbrite event, percent off, optional cap on students. */
  eventbriteEventId: z.string().trim().regex(/^\d+$/, "Pick an Eventbrite event").nullish(),
  appDiscountPercent: z.number().int().min(1).max(100).nullish(),
  appDiscountLimit: z.number().int().min(1).nullish(),
  /**
   * Re-pointing an event at another Eventbrite event after students already
   * hold codes strands those codes (they were minted for the old event). The
   * API refuses with 409 unless this is set.
   */
  forceRelink: z.boolean().optional(),
};

const endsAfterStart = (d: { startsAt?: string; endsAt?: string | null }, ctx: z.RefinementCtx) => {
  if (d.startsAt && d.endsAt && Date.parse(d.endsAt) < Date.parse(d.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End can't be before the start" });
  }
};

/** Admin create payload for an event. */
export const eventInput = z
  .object({
    ...eventFields,
    published: z.boolean().default(false),
    links: contentLinks,
  })
  .superRefine(endsAfterStart);
export type EventInput = z.infer<typeof eventInput>;

/** Admin update payload (partial, no defaults). See newsPatchInput. */
export const eventPatchInput = z
  .object(eventFields)
  .partial()
  .extend({ published: z.boolean().optional(), links: z.array(contentLink).max(6).optional() })
  .superRefine(endsAfterStart);

export const eventItem = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  externalTicketUrl: z.string().nullable(),
  published: z.boolean(),
  links: z.array(contentLink),
  createdAt: z.string(),
  eventbriteEventId: z.string().nullable(),
  /** Percent off when buying through the app; null = none. */
  appDiscountPercent: z.number().nullable(),
  appDiscountLimit: z.number().nullable(),
});
export type EventItem = z.infer<typeof eventItem>;

/**
 * POST /api/events/:id/ticket-link — where "Get tickets" should go. With an
 * in-app discount it carries the student's personal code; otherwise it's the
 * plain ticket link (code null), e.g. once the discount has run out.
 */
export const ticketLinkResponse = z.object({
  url: z.string(),
  code: z.string().nullable(),
  percentOff: z.number().nullable(),
  /**
   * Why there is (not) a code, so the app can tell "no discount on this event"
   * from "temporarily unavailable, try again". Absent from older servers.
   */
  discountStatus: z.enum(["applied", "none", "cap_reached", "unavailable"]).optional(),
});
export type TicketLinkResponse = z.infer<typeof ticketLinkResponse>;

export const eventListResponse = z.object({ items: z.array(eventItem) });
export type EventListResponse = z.infer<typeof eventListResponse>;

// ── Support ───────────────────────────────────────────────────────────────

/** What the student is writing in about. */
export const supportKind = z.enum(["QUESTION", "ISSUE", "IDEA"]);
export type SupportKind = z.infer<typeof supportKind>;

/** Message sent from the app's support screen. */
export const supportMessageInput = z.object({
  kind: supportKind.default("QUESTION"),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail")
    .max(4000, "That's too long — please shorten it"),
  /** Filled in by the app, not the student, so bug reports carry context. */
  appVersion: z.string().trim().max(32).nullish(),
  platform: z.string().trim().max(32).nullish(),
});
export type SupportMessageInput = z.infer<typeof supportMessageInput>;

// ── CMS: Rewards ──────────────────────────────────────────────────────────

/** "" from an empty form field means "not given", never a number. */
const blankToNull = (v: unknown) => (v === "" ? null : v);

const rewardFields = {
  title: z.string().trim().min(1, "Title is required").max(120, "Must be 120 characters or fewer"),
  description: optText(1000),
  imageUrl: optionalImageRef,
  costPoints: z.coerce.number().int().min(0, "Cost must be 0 or more").max(1_000_000, "Cost is too high"),
  /**
   * null = unlimited; a number = that many left. An empty box is an error, not
   * "0" (out of stock at once) and not "unlimited" (the opposite of what a
   * half-filled form means).
   */
  stock: z.preprocess(
    (v) => (v === "" ? Number.NaN : v),
    z.coerce.number({ error: "Enter the stock, or switch on Unlimited stock" }).int().min(0).max(1_000_000).nullish(),
  ),
  /** How many times one account may redeem this. Empty / null = no limit. */
  perUserLimit: z.preprocess(blankToNull, z.coerce.number().int().min(1, "Must be at least 1").max(1000).nullish()),
};

/** Admin create payload for a reward. */
export const rewardInput = z.object({ ...rewardFields, active: z.boolean().default(true) });
export type RewardInput = z.infer<typeof rewardInput>;

/** Admin update payload (partial, no defaults). See newsPatchInput. */
export const rewardPatchInput = z.object(rewardFields).partial().extend({ active: z.boolean().optional() });

export const rewardItem = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  costPoints: z.number().int(),
  stock: z.number().int().nullable(),
  perUserLimit: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
});
export type RewardItem = z.infer<typeof rewardItem>;

export const rewardListResponse = z.object({ items: z.array(rewardItem) });
export type RewardListResponse = z.infer<typeof rewardListResponse>;

// ── Partners & discounts ────────────────────────────────────────────────────
// Partner venues power the app's Discounts screen (map + list). Each partner
// carries a location (for the map pin) and one or more offers (the discount
// text students actually read). Adding a partner is a dashboard-only action —
// the app reads this live, so a new venue never requires an app release.

export const discountTypeValues = ["PERCENT", "FIXED", "FREEBIE", "OTHER"] as const;
export const discountTypeEnum = z.enum(discountTypeValues);
export type DiscountTypeValue = (typeof discountTypeValues)[number];

/** One discount attached to a partner. `id` is present when editing an existing row. */
export const partnerOfferInput = z
  .object({
    id: z.string().nullish(),
    title: z.string().trim().min(1, "Discount title is required").max(120, "Must be 120 characters or fewer"),
    description: optText(500),
    discountType: discountTypeEnum.default("OTHER"),
    // Percent (0-100) for PERCENT, cents for FIXED, unused otherwise.
    discountValue: z.coerce.number().int().min(0).max(1_000_000).nullish(),
    // Redeemed by scanning the student's card QR (the /api/partner/scan flow)
    // versus an informal discount with no digital redemption.
    qrEnabled: z.boolean().default(true),
  })
  .superRefine((o, ctx) => {
    if (o.discountType === "PERCENT" && o.discountValue != null && o.discountValue > 100) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "A percentage can't be more than 100" });
    }
  });
export type PartnerOfferInput = z.infer<typeof partnerOfferInput>;

const partnerFields = {
  name: z.string().trim().min(1, "Name is required").max(120, "Must be 120 characters or fewer"),
  description: optText(2000),
  category: optText(60),
  address: optText(300),
  // Nullable so a partner can be saved before its coordinates are known; such a
  // partner simply doesn't get a map pin (the list view still shows it).
  latitude: z.preprocess(blankToNull, z.coerce.number().min(-90).max(90).nullish()),
  longitude: z.preprocess(blankToNull, z.coerce.number().min(-180).max(180).nullish()),
  logoUrl: optionalImageRef,
  // Wider photo shown on the venue's detail screen; logoUrl stays the small
  // square mark used in list/map rows.
  photoUrl: optionalImageRef,
};

/** Admin create payload for a partner venue. */
export const partnerInput = z.object({
  ...partnerFields,
  active: z.boolean().default(true),
  offers: z.array(partnerOfferInput).max(20).default([]),
});
export type PartnerInput = z.infer<typeof partnerInput>;

/** Admin update payload (partial, no defaults). See newsPatchInput. */
export const partnerPatchInput = z
  .object(partnerFields)
  .partial()
  .extend({ active: z.boolean().optional(), offers: z.array(partnerOfferInput).max(20).optional() });

export const partnerOffer = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  discountType: discountTypeEnum,
  discountValue: z.number().int().nullable(),
  /** Ready-to-render summary, e.g. "20% off" — built server-side so every client agrees. */
  label: z.string(),
  qrEnabled: z.boolean(),
});
export type PartnerOffer = z.infer<typeof partnerOffer>;

export const partnerItem = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  logoUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
  active: z.boolean(),
  offers: z.array(partnerOffer),
});
export type PartnerItem = z.infer<typeof partnerItem>;

export const partnerListResponse = z.object({
  items: z.array(partnerItem),
  /** Distinct non-empty categories present in `items`, sorted — drives the list filter. */
  categories: z.array(z.string()),
});
export type PartnerListResponse = z.infer<typeof partnerListResponse>;

// ── Push notifications ──────────────────────────────────────────────────────

/** POST /api/push/register — register this device's Expo push token. */
const expoPushToken = z
  .string()
  .trim()
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Not an Expo push token");

export const pushRegisterInput = z.object({
  token: expoPushToken,
  platform: z.enum(["IOS", "ANDROID"]),
});
export type PushRegisterInput = z.infer<typeof pushRegisterInput>;

/** DELETE /api/push/register — forget this device's token (sign-out). */
export const pushUnregisterInput = z.object({ token: expoPushToken });
export type PushUnregisterInput = z.infer<typeof pushUnregisterInput>;

// ── Ask ASTRA (RAG chatbot) ─────────────────────────────────────────────────

/** POST /api/chat — ask the Bocconi/ASTRA knowledge base a question. */
export const chatInput = z.object({
  message: z.string().trim().min(1, "Ask a question").max(1000),
});
export type ChatInput = z.infer<typeof chatInput>;

export const materialItem = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  url: z.string(),
  semester: z.string().nullish(),
  examType: z.string().nullish(),
});
export const materialsResponse = z.object({
  years: z.array(
    z.object({
      year: z.string(),
      count: z.number(),
      subjects: z.array(
        z.object({
          subject: z.string(),
          items: z.array(materialItem),
        })
      ),
    })
  ),
});
export type MaterialsResponse = z.infer<typeof materialsResponse>;

/** GET /api/guides — ASTRA guides grouped by category, as on the website. */
export const guidesResponse = z.object({
  categories: z.array(
    z.object({
      category: z.string(),
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          url: z.string(),
          language: z.enum(["it", "en"]),
        })
      ),
    })
  ),
});
export type GuidesResponse = z.infer<typeof guidesResponse>;

export const chatResponse = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string().nullish(),
      sourceType: z.string().nullish(),
      page: z.number().nullish(),
      similarity: z.number(),
    })
  ),
  grounded: z.boolean(),
});
export type ChatResponse = z.infer<typeof chatResponse>;
