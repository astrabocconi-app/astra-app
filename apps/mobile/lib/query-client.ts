import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isTransientError } from "@astra/shared";
import { captureError } from "./sentry";

// Default staleTime was 0, so every query refetched on every mount AND every
// time the app came back to the foreground (see the focusManager wiring
// in app/_layout.tsx) — switching Home → Discounts → Home re-fetched all four Home
// queries from scratch each time, which is what made it feel slow to open.
// A minute-old news post or partner list is still correct; points-balance
// keeps its own tighter refetchInterval below since scans need to show up
// promptly.

/**
 * Failures worth a Sentry event: the server broke (5xx) or never answered in
 * time. A 4xx is the app talking to a healthy server and being told no; a
 * missing connection is the phone's problem, not ours.
 */
function shouldReport(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null;
  return e?.code === "TIMEOUT" || (typeof e?.status === "number" && e.status >= 500);
}

function report(error: unknown, what: string) {
  if (!shouldReport(error)) return;
  captureError(error, { what, requestId: (error as { requestId?: string } | null)?.requestId });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => report(error, `query ${JSON.stringify(query.queryKey)}`),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => report(error, `mutation ${JSON.stringify(mutation.options.mutationKey ?? null)}`),
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // One more try after a blip (a cold server start, a Wi-Fi handover), then
      // show Retry: with the 10 s read timeout that is 21 s at worst, not the
      // 87 s the old 3-retry policy took on a stalled link. A 4xx won't change
      // by asking again, and a rejected session is handled by the API client.
      retry: (failures, error) => failures < 1 && isTransientError(error),
      retryDelay: 1500,
    },
  },
});
