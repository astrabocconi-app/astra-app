import { router } from "expo-router";
import { createApiClient } from "@astra/shared/client";
import { API_URL } from "./config";
import { clearToken, getToken } from "./session";
import { queryClient } from "./query-client";
import { useBootStore } from "./boot-store";

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
 */
function signOutRejected() {
  if (!getToken()) return;
  void clearToken().then(() => {
    useBootStore.getState().done();
    queryClient.clear();
    router.replace("/");
  });
}
