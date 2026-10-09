import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { chatInput } from "@astra/shared";
import { newRequestId, errorResponse, withApi, log, describeError } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { askAstra } from "@/lib/rag";
import { zodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Per-user limits, counted in the database so they hold across serverless
// instances (an in-memory window is per lambda and multiplies with concurrency).
const PER_MINUTE = 10;
const PER_DAY = 100;

async function overLimit(userId: string): Promise<boolean> {
  const now = Date.now();
  const [minute, day] = await Promise.all([
    prisma.rateEvent.count({ where: { bucket: "chat", key: userId, createdAt: { gte: new Date(now - 60_000) } } }),
    prisma.rateEvent.count({ where: { bucket: "chat", key: userId, createdAt: { gte: new Date(now - 86_400_000) } } }),
  ]);
  if (minute >= PER_MINUTE || day >= PER_DAY) return true;
  await prisma.rateEvent.create({ data: { bucket: "chat", key: userId } });
  return false;
}

// POST /api/chat — ask the Ask-ASTRA knowledge base a question.
//
// Off unless CHAT_ENABLED=true: the screen is not in the app, and every call
// spends money on OpenAI, so the route does not exist until the feature does.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  if (process.env.CHAT_ENABLED !== "true") {
    return errorResponse(404, "NOT_FOUND", "Not found.", requestId);
  }
  const session = await getSessionUser(req.headers);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);

  if (!process.env.OPENAI_API_KEY) {
    return errorResponse(503, "NOT_CONFIGURED", "The assistant isn't available yet.", requestId);
  }
  if (await overLimit(session.user.id)) {
    return errorResponse(429, "RATE_LIMITED", "Too many questions — give it a moment.", requestId);
  }

  const parsed = chatInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "BAD_REQUEST", zodMessage(parsed.error), requestId);
  }

  try {
    const result = await askAstra(parsed.data.message);
    return NextResponse.json(result);
  } catch (e) {
    log("error", requestId, "chat upstream failed", { error: describeError(e) });
    return errorResponse(502, "UPSTREAM_ERROR", "The assistant had trouble answering.", requestId);
  }
}

export const POST = withApi(handlePost);
