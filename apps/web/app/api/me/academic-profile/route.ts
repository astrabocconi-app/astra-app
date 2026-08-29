import { NextResponse } from "next/server";
import { academicProfile, academicProfileInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { assertCan } from "@/lib/authz";
import { getSessionUser } from "@/lib/session";
import {
  AcademicSelectionError,
  getAcademicProfile,
  saveAcademicProfile,
  toAcademicProfile,
} from "@/lib/academic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  assertCan(session.actor, "self:read", { ownerId: session.user.id });

  const row = await getAcademicProfile(session.user.id);
  return NextResponse.json(
    { profile: row ? academicProfile.parse(toAcademicProfile(row)) : null },
    { headers: { "x-request-id": requestId } }
  );
}

export async function PUT(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  assertCan(session.actor, "self:write", { ownerId: session.user.id });

  const parsed = academicProfileInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid academic profile.",
      requestId
    );
  }

  try {
    const row = await saveAcademicProfile(session.user.id, parsed.data);
    return NextResponse.json(
      { profile: academicProfile.parse(toAcademicProfile(row)) },
      { headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    if (error instanceof AcademicSelectionError) {
      return errorResponse(400, "INVALID_SELECTION", error.message, requestId);
    }
    throw error;
  }
}
