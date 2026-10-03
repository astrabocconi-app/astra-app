import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { meResponse, updateMeInput, avatarSeed, AVATAR_PREFIX } from "@astra/shared";
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

  const body = await meBody(session.user);
  log("info", requestId, "GET /api/me", { userId: session.user.id });
  return NextResponse.json(body, { headers: { "x-request-id": requestId } });
}

async function meBody(user: { id: string; email: string; name: string | null; image: string | null; roles: string[] }) {
  const academic = await getAcademicProfile(user.id);
  return meResponse.parse({
    id: user.id,
    email: user.email,
    // Empty names exist from before sign-up asked for one; treat them as unset.
    name: user.name?.trim() || null,
    avatarSeed: avatarSeed(user.id, user.image),
    roles: user.roles,
    academicProfile: academic ? toAcademicProfile(academic) : null,
  });
}

// PATCH /api/me — the student sets their name (first + last, together) and/or
// picks another avatar.
export async function PATCH(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = updateMeInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const { firstName, lastName, avatarSeed: seed } = parsed.data;
  if (Boolean(firstName) !== Boolean(lastName)) {
    return errorResponse(400, "BAD_REQUEST", "Send both first and last name.", requestId);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(firstName && lastName ? { name: `${firstName} ${lastName}` } : {}),
      ...(seed ? { image: `${AVATAR_PREFIX}${seed}` } : {}),
    },
    select: { id: true, email: true, name: true, image: true, roles: true },
  });
  log("info", requestId, "PATCH /api/me", { userId: session.user.id, name: Boolean(firstName), avatar: Boolean(seed) });
  return NextResponse.json(await meBody(updated), { headers: { "x-request-id": requestId } });
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
