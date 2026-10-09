// Classifies a failed API call for the UI (no imports, so node:test can load it).
// Mirrors the ApiError the shared client throws: status 0 means no answer.

export type ErrorKind = "timeout" | "network" | "rateLimited" | "unauthorized" | "server" | "client";

export function errorKind(error: unknown): ErrorKind {
  const e = error as { status?: unknown; code?: unknown } | null;
  // Not an ApiError at all (a keychain write failing, a bug): not the network's fault.
  if (typeof e?.status !== "number") return "client";
  const status = e.status;
  if (e.code === "TIMEOUT") return "timeout";
  if (status === 0) return "network";
  if (status === 429) return "rateLimited";
  if (status === 401) return "unauthorized";
  if (status >= 500) return "server";
  return "client";
}

export function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}
