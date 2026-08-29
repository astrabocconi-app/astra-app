// Deciding a partner's map coordinates. SERVER-ONLY.
//
// Coordinates are derived from the address so staff never have to look them up,
// but an explicitly supplied pair always wins — that's the escape hatch for a
// venue the geocoder places badly (a courtyard entrance, a market stall).

import { geocodeAddress } from "./geocode";

export interface ResolvedCoordinates {
  latitude: number | null;
  longitude: number | null;
  /** Set when we geocoded, so the caller can log or surface what matched. */
  matchedAddress?: string;
}

/**
 * Work out the coordinates to store.
 *
 * - Both supplied → trust them (manual override).
 * - Address, no coordinates → geocode it.
 * - Neither → no pin; the venue still appears in the list view.
 *
 * A geocoding failure never blocks the save: partners are still useful without
 * a pin, and refusing to save because a third-party lookup is down would be a
 * worse outcome than a missing marker.
 */
export async function resolveCoordinates(args: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<ResolvedCoordinates> {
  const { address, latitude, longitude } = args;

  if (latitude != null && longitude != null) return { latitude, longitude };
  if (!address?.trim()) return { latitude: latitude ?? null, longitude: longitude ?? null };

  try {
    const hit = await geocodeAddress(address);
    if (!hit) return { latitude: null, longitude: null };
    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      matchedAddress: hit.matchedAddress,
    };
  } catch {
    return { latitude: null, longitude: null };
  }
}
