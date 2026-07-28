import { NextResponse } from "next/server";
import { academicCatalogueResponse } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getActiveAcademicCatalogue } from "@/lib/academic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const catalogue = await getActiveAcademicCatalogue();
  if (!catalogue) {
    return errorResponse(503, "NOT_CONFIGURED", "Academic catalogue is unavailable.", requestId);
  }

  const body = academicCatalogueResponse.parse({
    id: catalogue.id,
    academicYear: catalogue.academicYear,
    version: catalogue.version,
    sourceUrl: catalogue.sourceUrl,
    programmes: catalogue.programmes.map((programme) => ({
      id: programme.id,
      code: programme.code,
      name: programme.name,
      level: programme.level,
      durationYears: programme.durationYears,
      sourceUrl: programme.sourceUrl,
      legacy: programme.legacy,
      classGroups: programme.classGroups,
      tracks: programme.tracks,
    })),
  });
  return NextResponse.json(body, { headers: { "x-request-id": requestId } });
}
