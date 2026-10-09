import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { meResponse, updateMeInput, AVATAR_PREFIX } from "@astra/shared";
import { newRequestId, errorResponse, log, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { getAcademicProfile, toAcademicProfile } from "@/lib/academic";
import { deleteOwnAccount, AccountDeletionError } from "@/lib/account";
import { ensureAvatarSeed } from "@/lib/avatar-seed";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me — the authenticated student's profile.
// Resolves the Better Auth session (cookie or Bearer token), loads the User,
// and returns only the fields in MeResponse (@astra/shared).
async function handleGet(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
  }

  const body = await meBody(session.user);
  return NextResponse.json(body);
}

async function meBody(user: { id: string; email: string; name: string | null; image: string | null; roles: string[] }) {
  const [academic, avatarSeed] = await Promise.all([
    getAcademicProfile(user.id),
    // Never the user id: that is an internal identifier and the seed ends up in
    // image URLs. An account without a seed gets a random one, saved.
    ensureAvatarSeed(user.id, user.image),
  ]);
  return meResponse.parse({
    id: user.id,
    email: user.email,
    // Empty names exist from before sign-up asked for one; treat them as unset.
    name: user.name?.trim() || null,
    avatarSeed,
    roles: user.roles,
    academicProfile: academic ? toAcademicProfile(academic) : null,
  });
}

// PATCH /api/me — the student sets their name (first + last, together) and/or
// picks another avatar.
async function handlePatch(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = updateMeInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
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
  return NextResponse.json(await meBody(updated));
}

// DELETE /api/me — the student deletes their own account.
//
// Required by App Store guideline 5.1.1(v). Irreversible: it strips every
// identifying field, removes the login credentials and signs out every device.
async function handleDelete(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  try {
    const result = await deleteOwnAccount(session.user.id);
    log("info", requestId, "account deleted", { userId: session.user.id, ...result.removed });
    return NextResponse.json({ deleted: true, removed: result.removed });
  } catch (e) {
    if (e instanceof AccountDeletionError) {
      return errorResponse(400, "CANNOT_DELETE", e.message, requestId);
    }
    throw e;
  }
}

export const GET = withApi(handleGet);
export const PATCH = withApi(handlePatch);
export const DELETE = withApi(handleDelete);
