import { NextResponse } from "next/server";
import { prisma, Platform } from "@astra/db";
import { pushRegisterInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/push/register — store this device's Expo push token for the user.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = pushRegisterInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }
  const { token, platform } = parsed.data;

  // A token is unique to a device; re-registering re-points it at this user.
  await prisma.pushToken.upsert({
    where: { token },
    update: { userId: session.user.id, platform: platform as Platform },
    create: { token, platform: platform as Platform, userId: session.user.id },
  });
  return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId } });
}
