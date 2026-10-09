import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, log, withApi, describeError, upstreamFetch } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Probe = { status: "up" | "down" | "skipped"; ms: number };

async function timed(run: () => Promise<void>): Promise<Probe> {
  const started = Date.now();
  try {
    await run();
    return { status: "up", ms: Date.now() - started };
  } catch {
    return { status: "down", ms: Date.now() - started };
  }
}

// GET /api/health — liveness plus a probe of each dependency with its latency, so
// an uptime monitor (and a human) can tell "Neon is waking up" from "Supabase is
// down". `status`/`db` keep their original meaning; the rest is additive. Only
// the database decides the HTTP status: Supabase backs guides and handouts, which
// degrade on their own, so they must not page anyone for the whole app.
async function handleGet() {
  const requestId = newRequestId();
  const supabaseUrl = process.env.SUPABASE_URL;
  const [db, supabase] = await Promise.all([
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }).then((p) => {
      if (p.status === "down") log("error", requestId, "health db check failed", { error: describeError("db probe failed") });
      return p;
    }),
    supabaseUrl
      ? timed(async () => {
          // The REST root answers without touching any table.
          const res = await upstreamFetch("supabase-health", `${supabaseUrl}/rest/v1/`, {
            headers: { apikey: process.env.SUPABASE_SECRET_KEY ?? "" },
            timeoutMs: 4_000,
          });
          if (res.status >= 500) throw new Error(`status ${res.status}`);
        })
      : Promise.resolve<Probe>({ status: "skipped", ms: 0 }),
  ]);
  return NextResponse.json(
    {
      status: "ok",
      db: db.status,
      checks: { db, supabase },
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status: db.status === "up" ? 200 : 503 },
  );
}

export const GET = withApi(handleGet);
