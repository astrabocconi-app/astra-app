import { createApiClient } from "@astra/shared/client";
import { API_URL } from "./config";
import { getToken } from "./session";

// The mobile app's ONLY data path. It never imports Prisma or the DB — it calls
// apps/web's /api/* routes over HTTPS through this typed client. The Bearer
// token comes from the persisted session (SecureStore, cached in memory).
export const api = createApiClient({
  baseUrl: API_URL,
  getToken,
});
