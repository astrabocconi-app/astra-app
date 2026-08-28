import { NextResponse } from "next/server";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { geocodeAddress, isGeocodingConfigured, GeocodeError } from "@/lib/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ address: z.string().trim().min(1, "Enter an address") });

// POST /api/admin/geocode — resolve an address so the partner form can preview
// the pin before saving. Admin-only: it spends our Mapbox quota.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  if (!isGeocodingConfigured()) {
    return errorResponse(503, "NOT_CONFIGURED", "Address lookup isn't configured.", requestId);
  }

  try {
    const result = await geocodeAddress(parsed.data.address);
    if (!result) {
      return errorResponse(404, "NOT_FOUND", "No match for that address — try adding the city.", requestId);
    }
    return NextResponse.json(result, { headers: { "x-request-id": requestId } });
  } catch (e) {
    const message = e instanceof GeocodeError ? e.message : "Address lookup failed.";
    return errorResponse(502, "UPSTREAM_ERROR", message, requestId);
  }
}
