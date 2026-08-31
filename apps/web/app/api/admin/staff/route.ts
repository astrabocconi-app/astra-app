import { NextResponse } from "next/server";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-route";
import { writeAudit } from "@/lib/audit";
import {
  createStaffAccount,
  listStaffAccounts,
  StaffAccountError,
} from "@/lib/staff-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// requireAdmin, not requirePageApi: an account that can edit the team can grant
// itself anything, so this stays with the central admin whatever is ticked.

// GET /api/admin/staff — every backoffice account.
export async function GET(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  return NextResponse.json(
    { items: await listStaffAccounts() },
    { headers: { "x-request-id": requestId } },
  );
}

// POST /api/admin/staff — create an account.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAdmin(req, requestId);
  if ("error" in guard) return guard.error;

  const body = (await req.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
    name?: unknown;
    pages?: unknown;
  } | null;
  if (!body) return errorResponse(400, "BAD_REQUEST", "Invalid input.", requestId);

  try {
    const account = await createStaffAccount({
      username: String(body.username ?? ""),
      password: String(body.password ?? ""),
      name: typeof body.name === "string" ? body.name : null,
      pages: body.pages,
    });

    await writeAudit({
      actorId: guard.session.user.id,
      action: "staff.create",
      targetType: "User",
      targetId: account.id,
      // The password is never logged, here or anywhere.
      metadata: { username: account.username, pages: account.pages },
    });

    return NextResponse.json({ account }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    if (err instanceof StaffAccountError) {
      return errorResponse(400, "BAD_REQUEST", err.message, requestId);
    }
    throw err;
  }
}
