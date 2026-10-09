import { createApiClient } from "@astra/shared/client";
import { API_URL } from "./config";
import { getToken } from "./session";

// The mobile app's ONLY data path. It never imports Prisma or the DB — it calls
// apps/web's /api/* routes over HTTPS through this typed client. The Bearer
// token comes from the persisted session (SecureStore, cached in memory).
export const api = createApiClient({
  baseUrl: API_URL,
  getToken,
  onUnauthorized: signOutRejected,
});

/**
 * The server no longer accepts our token (session revoked, account deleted).
 * Cold boot trusts the stored token so the app opens offline, which used to
 * leave such a student on Home with every screen stuck on "Retry". Sign out
 * and show the login instead — once, however many requests failed together.
 *
 * Only when the rejected token is still THE token: a slow request from an
 * earlier session can come back 401 after a quick re-login and must not sign
 * the new session out.
 */
function signOutRejected(sentToken: string) {
  if (getToken() !== sentToken) return;
  // Imported on demand: sign-out reaches push registration, which uses this client.
  void import("./sign-out").then((m) => m.signOutAndReset({ serverKnowsUs: false }));
}
