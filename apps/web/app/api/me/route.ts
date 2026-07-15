import { newRequestId, notImplemented, log } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me — the authenticated student's profile (shape: MeResponse in
// @astra/shared). Real implementation is deferred with auth + the DB schema:
// it must (1) resolve the Better Auth session, (2) load the User via the Prisma
// client, (3) return only fields allowed by lib/authz.ts.
// TODO(US-002): implement once auth + packages/db land.
export async function GET() {
  const requestId = newRequestId();
  log("info", requestId, "GET /api/me (stub)");
  return notImplemented(requestId, "US-002 GET /api/me");
}
