import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only these keys are readable, so this can't be used to probe the table. */
const PUBLIC_KEYS = new Set(["astraworld"]);

// GET /api/content/:key — editable screen content.
//
// Unauthenticated on purpose: it is the same public event information the app
// already ships in its bundle, and requiring a session would mean the screen
// could not render before sign-in.
//
// 404 when unset is meaningful rather than an error: the app then uses its
// bundled copy, which is the correct behaviour on a fresh install or if the row
// is ever deleted.
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const requestId = newRequestId();
  const { key } = await ctx.params;

  if (!PUBLIC_KEYS.has(key)) {
    return errorResponse(404, "NOT_FOUND", "Unknown content key.", requestId);
  }

  const row = await prisma.appContent.findUnique({ where: { key } });
  if (!row) {
    return errorResponse(404, "NOT_SET", "No content stored for this key.", requestId);
  }

  return NextResponse.json(
    { key: row.key, data: row.data, updatedAt: row.updatedAt.toISOString() },
    {
      headers: {
        "x-request-id": requestId,
        // Short cache: edits should appear quickly, but a burst of app opens
        // should not become a burst of database reads.
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
