import { prisma } from "@astra/db";

export const runtime = "nodejs";

// GET /api/media/:id — serve stored image bytes. Public (referenced by an
// unguessable cuid); immutable + long-cached.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const asset = await prisma.imageAsset.findUnique({
    where: { id },
    select: { mimeType: true, data: true },
  });
  if (!asset) {
    return new Response("Not found", { status: 404 });
  }
  const body = new Uint8Array(asset.data);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
