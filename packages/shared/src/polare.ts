import { z } from "zod";

// Stella Polare feed: posts typed in by hand in the backoffice, shown in the app
// like a small Instagram. Images are our own /api/media/:id uploads (or https
// URLs); videos are https URLs in Vercel Blob (too big to pass through the API).

export const POLARE_KINDS = ["IMAGE", "CAROUSEL", "REEL"] as const;
export const POLARE_MAX_CAROUSEL = 10; // Instagram's own limit

const mediaUrl = z
  .string()
  .trim()
  .refine((v) => /^\/api\/media\/[A-Za-z0-9_-]+$/.test(v) || /^https:\/\/\S+$/.test(v), {
    message: "Enter an https:// URL, or upload a file",
  });

export const polareMedia = z.object({
  type: z.enum(["image", "video"]),
  url: mediaUrl,
  /** Video cover, shown until it plays. */
  posterUrl: mediaUrl.nullish().transform((v) => v ?? null),
  alt: z.string().trim().max(300).nullish().transform((v) => v || null),
  width: z.number().int().positive().max(10000).nullish().transform((v) => v ?? null),
  height: z.number().int().positive().max(10000).nullish().transform((v) => v ?? null),
});
export type PolareMedia = z.infer<typeof polareMedia>;

const fields = {
  kind: z.enum(POLARE_KINDS),
  caption: z.string().trim().max(2200, "Must be 2,200 characters or fewer").default(""),
  media: z.array(polareMedia).min(1, "Add at least one photo or video").max(POLARE_MAX_CAROUSEL),
  externalUrl: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/\S+$/.test(v), { message: "Links must start with https://" }),
};

/** Whether a media list is valid for its kind (shared by create and update). */
function kindFits(d: { kind?: (typeof POLARE_KINDS)[number]; media?: PolareMedia[] }): boolean {
  if (!d.kind || !d.media) return true;
  if (d.kind === "IMAGE") return d.media.length === 1 && d.media[0]!.type === "image";
  if (d.kind === "REEL") return d.media.length === 1 && d.media[0]!.type === "video";
  return d.media.length >= 2;
}
const KIND_MESSAGE = "A photo needs one image, a reel one video, and a carousel two or more items";

export const polareInput = z
  .object({
    ...fields,
    published: z.boolean().default(false),
    pinned: z.boolean().default(false),
    /** ISO with offset; omitted = now when first published. */
    publishedAt: z.iso.datetime({ offset: true }).nullish(),
  })
  .refine(kindFits, { message: KIND_MESSAGE, path: ["media"] });
export type PolareInput = z.infer<typeof polareInput>;

/** Update payload: every field optional, no defaults (a partial save must not reset anything). */
export const polarePatchInput = z
  .object(fields)
  .partial()
  .extend({
    published: z.boolean().optional(),
    pinned: z.boolean().optional(),
    publishedAt: z.iso.datetime({ offset: true }).nullish(),
  })
  .refine(kindFits, { message: KIND_MESSAGE, path: ["media"] });

export const polarePost = z.object({
  id: z.string(),
  kind: z.enum(POLARE_KINDS),
  caption: z.string(),
  media: z.array(polareMedia),
  externalUrl: z.string().nullable(),
  pinned: z.boolean(),
  published: z.boolean(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PolarePost = z.infer<typeof polarePost>;

export const polareListResponse = z.object({ items: z.array(polarePost) });
export type PolareListResponse = z.infer<typeof polareListResponse>;

type StoredPolare = { kind: string; caption: string; media: unknown; externalUrl: string | null; published: boolean; pinned: boolean };

/**
 * A stored post with an update applied, validated as a whole. The patch schema
 * can't check kind against media when only one of them is sent (a reel switched
 * to a photo keeps its video), so the merged post goes through the full schema.
 */
export function mergePolare(
  existing: StoredPolare,
  patch: Partial<Pick<PolareInput, "kind" | "caption" | "media" | "externalUrl" | "published" | "pinned">>,
) {
  return polareInput.safeParse({
    kind: patch.kind ?? existing.kind,
    caption: patch.caption ?? existing.caption,
    media: patch.media ?? existing.media,
    externalUrl: patch.externalUrl !== undefined ? patch.externalUrl : existing.externalUrl,
    published: patch.published ?? existing.published,
    pinned: patch.pinned ?? existing.pinned,
  });
}
