import { newRequestId, errorResponse, withApi, upstreamFetch } from "@/lib/api";

export const runtime = "nodejs";

const SEED = /^[A-Za-z0-9_-]{1,40}$/;
const MIN_SIZE = 32;
const MAX_SIZE = 512;

// GET /api/avatar/:seed?size=NN — the DiceBear avatar for a seed, as a PNG.
//
// Public, like /api/media: the seed is random and carries nothing about the
// person. Proxying it means the phone talks to us, never to a third party, so
// DiceBear learns neither the student's IP nor which avatar belongs to whom.
// The bytes for a (seed, size) never change, hence the immutable year-long cache.
// On any upstream trouble the answer is 502 and the app shows initials.
async function handleGet(req: Request, ctx: { params: Promise<{ seed: string }> }) {
  const requestId = newRequestId();
  const { seed } = await ctx.params;
  if (!SEED.test(seed)) return errorResponse(400, "BAD_REQUEST", "Invalid avatar seed.", requestId);

  const raw = Number(new URL(req.url).searchParams.get("size") ?? 128);
  const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number.isFinite(raw) ? Math.round(raw) : 128));

  try {
    const upstream = await upstreamFetch(
      "dicebear",
      `https://api.dicebear.com/10.x/adventurer-neutral/png?seed=${encodeURIComponent(seed)}&size=${size}`,
      { timeoutMs: 6_000 },
    );
    if (!upstream.ok) return errorResponse(502, "UPSTREAM_ERROR", "Avatar unavailable.", requestId);
    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return errorResponse(502, "UPSTREAM_ERROR", "Avatar unavailable.", requestId);
  }
}

export const GET = withApi(handleGet);
