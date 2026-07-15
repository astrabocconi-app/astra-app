// Shared API helpers for route handlers: request id, structured logging, a
// centralized error-response helper, and CORS restricted to known origins.
//
// SERVER-ONLY. Never import this from client components.

import { NextResponse } from "next/server";

/** Origins allowed to call the API (Expo dev client + production app). */
export function allowedOrigins(): string[] {
  return (process.env.MOBILE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  const allow = origin && allowed.includes(origin) ? origin : "";
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    vary: "origin",
  };
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

/** Minimal structured logger. Swap for a real sink (Sentry/console JSON) later. */
export function log(
  level: "info" | "warn" | "error",
  requestId: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  // eslint-disable-next-line no-console
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
  requestId: string
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status }
  );
}

/** 501 helper for the many endpoints that are stubbed during the pilot. */
export function notImplemented(requestId: string, story: string): NextResponse {
  return errorResponse(501, "NOT_IMPLEMENTED", `Not implemented — ${story}`, requestId);
}
