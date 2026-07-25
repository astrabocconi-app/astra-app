import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, log } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness + Neon connectivity check.
export async function GET() {
  const requestId = newRequestId();
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch (e) {
    log("error", requestId, "health db check failed", { error: String(e) });
  }
  return NextResponse.json(
    { status: "ok", db, requestId, timestamp: new Date().toISOString() },
    { status: db === "up" ? 200 : 503, headers: { "x-request-id": requestId } }
  );
}
