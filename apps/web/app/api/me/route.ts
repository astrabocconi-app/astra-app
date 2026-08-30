import { NextResponse } from "next/server";
import { meResponse } from "@astra/shared";
import { newRequestId, errorResponse, log } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getAcademicProfile, toAcademicProfile } from "@/lib/academic";
import { deleteOwnAccount, AccountDeletionError } from "@/lib/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me — the authenticated student's profile.
// Resolves the Better Auth session (cookie or Bearer token), loads the User,
// and returns only the fields in MeResponse (@astra/shared).
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }

  const academic = await getAcademicProfile(session.user.id);
  const body = meResponse.parse({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roles: session.user.roles,
    academicProfile: academic ? toAcademicProfile(academic) : null,
  });
  log("info", requestId, "GET /api/me", { userId: session.user.id });
  return NextResponse.json(body, { headers: { "x-request-id": requestId } });
}

// DELETE /api/me — the student deletes their own account.
//
// Required by App Store guideline 5.1.1(v). Irreversible: it strips every
// identifying field, removes the login credentials and signs out every device.
export async function DELETE(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  try {
    const result = await deleteOwnAccount(session.user.id);
    log("info", requestId, "DELETE /api/me", { userId: session.user.id, ...result.removed });
    return NextResponse.json(
      { deleted: true, removed: result.removed },
      { headers: { "x-request-id": requestId } },
    );
  } catch (e) {
    if (e instanceof AccountDeletionError) {
      return errorResponse(400, "CANNOT_DELETE", e.message, requestId);
    }
    throw e;
  }
}
