import type { MeResponse } from "../schemas";

// Typed API client used by the mobile app to call apps/web's /api/* routes.
// Mobile NEVER touches the DB — this HTTPS client is its only data path.
//
// TODO(scaffold): flesh out auth headers, error mapping, and the full set of
// endpoints as they come online. For now it demonstrates the intended shape.

export interface ApiClientOptions {
  /** Base URL of the deployed apps/web instance, e.g. https://astra.example.com */
  baseUrl: string;
  /** Optional bearer/session token provider. */
  getToken?: () => string | null | undefined;
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, getToken } = options;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken?.();
    const res = await fetch(new URL(path, baseUrl), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`ASTRA API ${res.status} on ${path}`);
    }
    return (await res.json()) as T;
  }

  return {
    /** GET /api/health — liveness + DB connectivity check. */
    health: () => request<{ status: string }>("/api/health"),
    /** GET /api/me — the authenticated student's profile. */
    me: () => request<MeResponse>("/api/me"),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
