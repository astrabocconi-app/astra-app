import { NextResponse } from "next/server";
import { newRequestId, log } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness check.
// TODO(scaffold): once packages/db exposes the Prisma client, verify Neon
// connectivity here with `await prisma.$queryRaw\`SELECT 1\`` and report "db": "up".
export async function GET() {
  const requestId = newRequestId();
  log("info", requestId, "health check");
  return NextResponse.json(
    { status: "ok", db: "unchecked", requestId, timestamp: new Date().toISOString() },
    { headers: { "x-request-id": requestId } }
  );
}
