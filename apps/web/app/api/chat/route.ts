import { NextResponse } from "next/server";
import { chatInput } from "@astra/shared";
import { newRequestId, errorResponse } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { askAstra } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight per-user rate limit (sliding window). In-memory, so it's per
// serverless instance — a soft guard against runaway OpenAI spend, not a hard
// global limit. For strict limits, back this with Redis/Upstash later.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

// POST /api/chat — ask the Ask-ASTRA knowledge base a question.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  if (!process.env.OPENAI_API_KEY) {
    return errorResponse(503, "NOT_CONFIGURED", "The assistant isn't available yet.", requestId);
  }
  if (rateLimited(session.user.id)) {
    return errorResponse(429, "RATE_LIMITED", "Too many questions — give it a moment.", requestId);
  }

  const parsed = chatInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input.", requestId);
  }

  try {
    const result = await askAstra(parsed.data.message);
    return NextResponse.json(result, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(
      502,
      "UPSTREAM_ERROR",
      e instanceof Error ? e.message : "The assistant had trouble answering.",
      requestId,
    );
  }
}
