import { useQuery } from "@tanstack/react-query";
import {
  homeBubbleContent,
  mapSponsorsContent,
  type HomeBubbleContent,
  type MapSponsorsContent,
} from "@astra/shared";
import { api } from "./api";

// Backoffice-edited overlays (AppContent rows), read live. A missing, disabled
// or malformed document means "show nothing", never a broken overlay.

const STALE = 60_000;

export function useHomeBubble(): HomeBubbleContent | null {
  const q = useQuery({
    queryKey: ["content", "home-bubble"],
    queryFn: () => api.content("home-bubble"),
    staleTime: STALE,
  });
  const parsed = homeBubbleContent.safeParse(q.data ?? {});
  return parsed.success && parsed.data.enabled && parsed.data.logoUrl ? parsed.data : null;
}

/** `undefined` while the first read is in flight, `null` when there is nothing to show. */
export function useMapSponsors(): MapSponsorsContent | null | undefined {
  const q = useQuery({
    queryKey: ["content", "map-sponsors"],
    queryFn: () => api.content("map-sponsors"),
    staleTime: STALE,
  });
  if (q.isPending) return undefined;
  const parsed = mapSponsorsContent.safeParse(q.data ?? {});
  return parsed.success && parsed.data.enabled && parsed.data.sponsors.length > 0 ? parsed.data : null;
}
