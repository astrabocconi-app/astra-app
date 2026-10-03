import { QueryClient } from "@tanstack/react-query";

// Default staleTime was 0, so every query refetched on every mount AND every
// time the app came back to the foreground (see the focusManager wiring
// in app/_layout.tsx) — switching Home → Discounts → Home re-fetched all four Home
// queries from scratch each time, which is what made it feel slow to open.
// A minute-old news post or partner list is still correct; points-balance
// keeps its own tighter refetchInterval below since scans need to show up
// promptly.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // A failure on opening the app (connection still waking up, a cold
      // server start) used to leave every screen on "Retry" until something
      // refetched — minutes, sometimes. Transient failures now retry after
      // 1 s, 2 s and 4 s; a 4xx answer won't change by asking again.
      retry: (failures, error) => {
        const status = (error as { status?: number }).status ?? 0;
        return failures < 3 && !(status >= 400 && status < 500);
      },
    },
  },
});
