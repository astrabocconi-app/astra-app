import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { isConfigured } from "@/lib/materials";
import { fetchGuides } from "@/lib/guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/guides — ASTRA's guides, grouped by category, read live from Supabase.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  if (!isConfigured()) {
    return errorResponse(503, "NOT_CONFIGURED", "Guides aren't available yet.", requestId);
  }
  try {
    const categories = await fetchGuides();
    return NextResponse.json({ categories }, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(
      502,
      "UPSTREAM_ERROR",
      e instanceof Error ? e.message : "Couldn't load guides.",
      requestId
    );
  }
}
