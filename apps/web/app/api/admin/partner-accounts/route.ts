import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import { createPartnerAccount } from "@/lib/partner-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  partnerId: z.string().min(1, "Pick a venue"),
  loginCode: z.string().trim().min(3, "Login code must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  label: z.string().trim().nullish(),
  scanOnly: z.boolean().default(false),
});

// GET /api/admin/partner-accounts — every venue login, grouped-ready.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "partner-logins");
  if ("error" in guard) return guard.error;

  const rows = await prisma.partnerMembership.findMany({
    include: { partner: { select: { id: true, name: true } } },
    orderBy: [{ partner: { name: "asc" } }, { createdAt: "asc" }],
  });
  return NextResponse.json(
    {
      items: rows.map((r) => ({
        id: r.id,
        partnerId: r.partnerId,
        partnerName: r.partner.name,
        loginCode: r.loginCode,
        label: r.label,
        scanOnly: r.scanOnly,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/partner-accounts — issue a new login for a venue.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requirePageApi(req, requestId, "partner-logins");
  if ("error" in guard) return guard.error;

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }

  try {
    const created = await createPartnerAccount(parsed.data);
    await writeAudit({
      actorId: guard.session.user.id,
      action: "create",
      targetType: "PartnerAccount",
      targetId: created.id,
      metadata: {
        name: `${created.partner.name} · ${created.loginCode}`,
        scanOnly: created.scanOnly,
      },
    });
    return NextResponse.json(
      { id: created.id, loginCode: created.loginCode, scanOnly: created.scanOnly },
      { status: 201, headers: { "x-request-id": requestId } },
    );
  } catch (e) {
    return errorResponse(
      400,
      "BAD_REQUEST",
      e instanceof Error ? e.message : "Couldn't create the account.",
      requestId,
    );
  }
}
