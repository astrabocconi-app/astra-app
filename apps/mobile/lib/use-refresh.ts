import { useState } from "react";
import { useEggStore } from "./egg-store";

/**
 * Props for a pull-to-refresh RefreshControl: `<RefreshControl {...refresh} />`.
 *
 * The spinner tracks the pull itself, not the queries' isFetching, so a
 * background refetch (refetchInterval, app foreground) never shows it.
 */
export function useRefresh(...refetchers: (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);
  const inverted = useEggStore((s) => s.inverted);
  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all(refetchers.map((refetch) => refetch()));
    } finally {
      setRefreshing(false);
    }
  }
  return { refreshing, onRefresh, tintColor: inverted ? "#fff" : undefined };
}
