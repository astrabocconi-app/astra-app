import { NextResponse } from "next/server";
import { prisma, Platform } from "@astra/db";
import { pushRegisterInput, pushUnregisterInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/push/register — store this device's Expo push token for the user.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = pushRegisterInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const { token, platform } = parsed.data;

  // A token is unique to a device; re-registering re-points it at this user.
  await prisma.pushToken.upsert({
    where: { token },
    update: { userId: session.user.id, platform: platform as Platform },
    create: { token, platform: platform as Platform, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/push/register { token } — this device stops receiving the signed-in
// user's notifications (sign-out). Only the caller's own token is touched, so one
// account cannot unregister another's device; an unknown token is not an error.
async function handleDelete(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = pushUnregisterInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }
  const { count } = await prisma.pushToken.deleteMany({
    where: { token: parsed.data.token, userId: session.user.id },
  });
  return NextResponse.json({ ok: true, removed: count });
}

export const POST = withApi(handlePost);
export const DELETE = withApi(handleDelete);
