import { createApiClient } from "@astra/shared/client";
import { API_URL } from "./config";

// The mobile app's ONLY data path. It never imports Prisma or the DB — it calls
// apps/web's /api/* routes over HTTPS through this typed client.
// TODO(scaffold): plug in the session-token provider once auth lands.
export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => null,
});
