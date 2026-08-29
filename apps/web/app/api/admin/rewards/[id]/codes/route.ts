import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { z } from "zod";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  // Pasted straight from Eventbrite — one code per line.
  codes: z.string().min(1, "Paste at least one code"),
});

// GET /api/admin/rewards/:id/codes — pool status and the unclaimed codes.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const rows = await prisma.rewardCode.findMany({
    where: { rewardId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, claimedAt: true },
  });
  return NextResponse.json(
    {
      total: rows.length,
      available: rows.filter((r) => r.claimedAt === null).length,
      codes: rows.map((r) => ({ ...r, claimedAt: r.claimedAt?.toISOString() ?? null })),
    },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/rewards/:id/codes — add vouchers to the pool.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  const reward = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!reward) return errorResponse(404, "NOT_FOUND", "Reward not found.", requestId);

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }

  const codes = [
    ...new Set(
      parsed.data.codes
        .split(/[\r\n,;]+/)
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  if (codes.length === 0) {
    return errorResponse(400, "BAD_REQUEST", "No usable codes found.", requestId);
  }

  // skipDuplicates so re-pasting a list that overlaps an earlier upload adds
  // only what's new rather than failing the whole batch.
  const result = await prisma.rewardCode.createMany({
    data: codes.map((code) => ({ rewardId: id, code })),
    skipDuplicates: true,
  });

  await writeAudit({
    actorId: guard.session.user.id,
    action: "update",
    targetType: "RewardCode",
    targetId: id,
    metadata: { title: reward.title, added: result.count, submitted: codes.length },
  });

  return NextResponse.json(
    { added: result.count, skipped: codes.length - result.count },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}

// DELETE /api/admin/rewards/:id/codes — drop every UNCLAIMED code.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  // Claimed codes are never removed — a student is holding them.
  const result = await prisma.rewardCode.deleteMany({
    where: { rewardId: id, claimedAt: null },
  });
  return NextResponse.json({ removed: result.count }, { headers: { "x-request-id": requestId } });
}
