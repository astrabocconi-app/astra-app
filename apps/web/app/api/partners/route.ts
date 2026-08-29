import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { toPartnerItem, originFromRequest } from "@/lib/cms-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/partners — active partner venues + their live discounts, for the
// mobile Discounts screen (map + list). Read live by the app, so adding a
// partner in the dashboard reaches students without an app release.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  const rows = await prisma.partner.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      offers: {
        where: { active: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const origin = originFromRequest(req);
  const items = rows.map((p) => toPartnerItem(p, origin));
  const categories = [
    ...new Set(items.map((p) => p.category?.trim()).filter((c): c is string => !!c)),
  ].sort((a, b) => a.localeCompare(b));

  return NextResponse.json(
    { items, categories },
    { headers: { "x-request-id": requestId } },
  );
}
