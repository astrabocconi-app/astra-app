"use client";

// The one way dashboard client code talks to /api/admin/*.
//
// - 401 (session gone): send the person to /signin?next=<here> instead of
//   leaving a filled-in form that can never save.
// - 403: a plain "not allowed" message (the server's own wording wins).
// - Network failure / non-JSON reply: a readable message, never a raw TypeError.
// Callers wrap it in try/catch and reset their busy flag in `finally`.

export class AdminFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminFetchError";
    this.status = status;
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-serialised. Pass FormData as `form` for uploads. */
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
};

function toSignIn() {
  if (typeof window === "undefined") return;
  const here = window.location.pathname + window.location.search;
  window.location.assign(`/signin?next=${encodeURIComponent(here)}`);
}

export async function adminFetch<T = Record<string, unknown>>(
  path: string,
  { method = "GET", body, form, signal }: Options = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "include",
      signal,
      headers: form || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new AdminFetchError("Couldn't reach the server. Check your connection and try again.", 0);
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;

  if (res.ok) return (data ?? {}) as T;

  const serverMessage = data?.error?.message;
  if (res.status === 401) {
    toSignIn();
    throw new AdminFetchError("Your session has ended. Taking you to sign in…", 401);
  }
  if (res.status === 403) {
    throw new AdminFetchError(serverMessage ?? "You don't have permission to do this.", 403);
  }
  if (res.status === 413) {
    throw new AdminFetchError(serverMessage ?? "That file is too large to upload.", 413);
  }
  if (res.status === 429) {
    throw new AdminFetchError(serverMessage ?? "Too many requests. Wait a moment and try again.", 429);
  }
  throw new AdminFetchError(
    serverMessage ?? (res.status >= 500 ? "The server hit a problem. Try again in a moment." : "Something went wrong."),
    res.status,
  );
}

/** Message to show for any thrown value from adminFetch. */
export function errorMessage(e: unknown, fallback = "Something went wrong."): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
