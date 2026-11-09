import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { consentInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/me/consent — record that the signed-in student ticked "I accept the
// privacy policy" before asking for their sign-in code. One row per acceptance
// (the Consent table is the history); a repeat of the latest version is a no-op.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const parsed = consentInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "BAD_REQUEST", "Bad consent.", requestId);
  const { policyVersion } = parsed.data;

  const latest = await prisma.consent.findFirst({
    where: { userId: session.user.id },
    orderBy: { acceptedAt: "desc" },
    select: { policyVersion: true },
  });
  if (latest?.policyVersion !== policyVersion) {
    await prisma.consent.create({ data: { userId: session.user.id, policyVersion } });
  }
  return NextResponse.json({ ok: true });
}

export const POST = withApi(handlePost);
