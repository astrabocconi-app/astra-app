// Shared API helpers for route handlers: request id, one structured log line
// per request, a centralized error-response helper, and timed outbound fetches.
//
// SERVER-ONLY. Never import this from client components.
//
// Every handler under app/api is exported through withApi(). It gives the
// request an id (the caller's x-request-id header when it looks sane, else a
// new one), times it, turns anything a handler throws into the standard error
// body, and writes ONE JSON line when the response is done:
//   { requestId, route, method, userId?, status, ms, error? }
// That line is what answers "why is every screen on Retry": a 401 vs a 502 from
// Supabase vs a lambda timeout are all visible, matched to the request id the
// app shows. Never put PII (emails, names, message bodies) in it.

import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "./authz";

interface RequestContext {
  requestId: string;
  route: string;
  method: string;
  userId?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

const INCOMING_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * The current request's id. Handlers call this first thing, as before; inside
 * withApi it returns the id the wrapper already minted, so the log line, the
 * x-request-id header and the error body all agree.
 */
export function newRequestId(): string {
  return als.getStore()?.requestId ?? crypto.randomUUID();
}

/** Tag the current request's log line with the signed-in user (an id, never an email). */
export function setRequestUser(userId: string): void {
  const ctx = als.getStore();
  if (ctx) ctx.userId = userId;
}

/** Collapse ids so every request to a route logs under one name: /api/events/:id/ticket-link. */
export function routeName(pathname: string): string {
  return pathname
    .split("/")
    .map((seg) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^c[a-z0-9]{20,}$/.test(seg) || /^\d{4,}$/.test(seg)
        ? ":id"
        : seg,
    )
    .join("/");
}

/** Error text safe to log: the first line, emails masked, capped. */
export function describeError(e: unknown): string {
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return raw
    .split("\n")[0]!
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .slice(0, 300);
}

/** Minimal structured logger: one JSON line per call, on the console stream of its level. */
export function log(
  level: "info" | "warn" | "error",
  requestId: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  console[level](JSON.stringify({ level, requestId, message, ...extra }));
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}

/** Centralized error response. Use everywhere instead of ad-hoc NextResponse. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, requestId } }, { status });
}

/**
 * JSON for data that is the same for everybody for a while (the programme
 * catalogue, the news feed): a short private cache lifetime plus an ETag, so a
 * client that already has it gets an empty 304 and repeated opens within the
 * window never reach the function at all. `private` keeps shared caches out.
 */
export function cachedJson(req: Request, body: unknown, maxAgeSeconds: number): Response {
  const json = JSON.stringify(body);
  const etag = `"${createHash("sha1").update(json).digest("base64url")}"`;
  const headers = {
    etag,
    "cache-control": `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 4}`,
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(json, { status: 200, headers: { ...headers, "content-type": "application/json" } });
}

/** Does this look like a Prisma/pg connection or timeout failure (as opposed to a bug)? */
function isDatabaseUnavailable(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  const msg = e instanceof Error ? e.message : "";
  return (
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017" ||
    code === "P2024" ||
    /timeout|ECONNREFUSED|ECONNRESET|ETIMEDOUT|terminating connection/i.test(msg)
  );
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response> | Response;

/**
 * Wrap a route handler. Anything it throws becomes the standard error body with
 * the request id (never a blank Next 500), and every response carries
 * x-request-id and, unless the handler chose its own, `Cache-Control: private,
 * no-store` so a shared cache can never keep an authenticated answer.
 */
export function withApi<C = unknown>(handler: Handler<C>): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const incoming = req.headers.get("x-request-id");
    const requestId = incoming && INCOMING_ID.test(incoming) ? incoming : crypto.randomUUID();
    const store: RequestContext = {
      requestId,
      route: routeName(new URL(req.url).pathname),
      method: req.method,
    };
    const started = Date.now();

    return als.run(store, async () => {
      let res: Response;
      let error: string | undefined;
      try {
        res = await handler(req, ctx);
      } catch (e) {
        error = describeError(e);
        if (e instanceof UnauthorizedError) {
          res = errorResponse(401, "UNAUTHORIZED", "Not signed in.", requestId);
        } else if (e instanceof ForbiddenError) {
          res = errorResponse(403, "FORBIDDEN", "You can't do that.", requestId);
        } else if (isDatabaseUnavailable(e)) {
          res = errorResponse(503, "UNAVAILABLE", "The service is busy. Please try again in a moment.", requestId);
        } else {
          res = errorResponse(500, "INTERNAL", "Something went wrong.", requestId);
        }
      }

      try {
        res.headers.set("x-request-id", requestId);
        if (!res.headers.has("cache-control")) res.headers.set("cache-control", "private, no-store");
      } catch {
        // Immutable headers (a proxied upstream Response): rebuild around the body.
        res = new Response(res.body, res);
        res.headers.set("x-request-id", requestId);
        if (!res.headers.has("cache-control")) res.headers.set("cache-control", "private, no-store");
      }

      const line: Record<string, unknown> = {
        level: res.status >= 500 ? "error" : res.status >= 400 ? "warn" : "info",
        requestId,
        route: store.route,
        method: store.method,
        status: res.status,
        ms: Date.now() - started,
      };
      if (store.userId) line.userId = store.userId;
      if (error) line.error = error;
      console[line.level as "info" | "warn" | "error"](JSON.stringify(line));
      return res;
    });
  };
}

export interface UpstreamInit extends RequestInit {
  /** Hard stop for the whole call, headers and body. */
  timeoutMs: number;
}

/**
 * fetch() for third-party services: always bounded in time, and every failure or
 * non-2xx is logged with the upstream's name, status and duration (never the
 * URL, which can carry tokens). A timeout rejects like any network error; the
 * caller decides what graceful fallback to give.
 */
export async function upstreamFetch(
  upstream: string,
  input: string | URL,
  init: UpstreamInit,
): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  const started = Date.now();
  const requestId = als.getStore()?.requestId ?? "-";
  try {
    const res = await fetch(input, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      log("warn", requestId, "upstream non-2xx", { upstream, status: res.status, ms: Date.now() - started });
    }
    return res;
  } catch (e) {
    log("error", requestId, "upstream failed", {
      upstream,
      ms: Date.now() - started,
      error: describeError(e),
    });
    throw e;
  }
}
