import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// Query definitions shared by the screens and by the Home prefetch below. The
// keys have to match exactly, or the prefetched data is never reused.
export const queries = {
  classrooms: (day: string, time: string | null) => ({
    queryKey: ["classrooms", day, time] as const,
    queryFn: () => api.classrooms.list({ day, time: time ?? undefined }),
    // Free@B itself refreshes every few minutes; a 2-minute-old answer is fine
    // and means reopening the screen shows rooms instantly.
    staleTime: 120_000,
  }),
  events: () => ({ queryKey: ["events"] as const, queryFn: () => api.events.list() }),
  partners: () => ({ queryKey: ["partners"] as const, queryFn: () => api.partners.list() }),
};

/**
 * Warm the slow screens while the student is looking at Home, so Free@B,
 * Events and Discounts open with data instead of a spinner. Free@B goes first:
 * it waits on a live scrape of Bocconi's timetable and is the slowest by far.
 */
export function usePrefetchScreens() {
  const qc = useQueryClient();
  useEffect(() => {
    void qc.prefetchQuery(queries.classrooms("today", null));
    void qc.prefetchQuery(queries.events());
    void qc.prefetchQuery(queries.partners());
  }, [qc]);
}
