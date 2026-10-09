import { NextResponse } from "next/server";
import { newRequestId, errorResponse, withApi, log, describeError } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { fetchMaterials, filterMaterialsForAcademicProfile, isConfigured } from "@/lib/materials";
import { getAcademicProfile } from "@/lib/academic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/materials — handouts catalogue (year → subject → items), read live
// from Supabase. The mobile app links straight to each file_url.
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  if (!isConfigured()) {
    return errorResponse(503, "NOT_CONFIGURED", "Materials aren't available yet.", requestId);
  }

  try {
    const [allYears, academic] = await Promise.all([
      fetchMaterials(),
      getAcademicProfile(session.user.id),
    ]);
    // ?allYears=1 widens the result to the student's whole programme rather
    // than only their current year.
    const wantsAllYears = new URL(req.url).searchParams.get("allYears") === "1";
    const years = academic
      ? filterMaterialsForAcademicProfile(
          allYears,
          academic.programme.code,
          academic.studyYear,
          { allYears: wantsAllYears, level: academic.programme.level },
        )
      : [];
    return NextResponse.json({ years });
  } catch (e) {
    // The upstream's own error page or message never reaches the student.
    log("error", requestId, "materials upstream failed", { error: describeError(e) });
    return errorResponse(502, "UPSTREAM_ERROR", "Couldn't load materials. Try again shortly.", requestId);
  }
}

export const GET = withApi(handleGet);
