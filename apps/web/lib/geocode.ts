// Address → coordinates, via the Mapbox Geocoding API. SERVER-ONLY.
//
// Staff type an address; the map pin is derived from it, so nobody has to go
// hunting for latitude/longitude in Google Maps. Results are biased towards
// Milan (proximity + country filter) because essentially every ASTRA partner
// is near campus, which stops "Via Roma" resolving to a different city.
//
// Uses the same Mapbox account as the app's map. The token is read server-side
// only — it never reaches the dashboard bundle.

import { BOCCONI_CAMPUS } from "@astra/shared";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  /** Mapbox's normalised address, so the admin can confirm the right match. */
  matchedAddress: string;
}

function token(): string | null {
  const t = process.env.MAPBOX_TOKEN ?? process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  return t && !t.includes("xxxx") ? t : null;
}

export function isGeocodingConfigured(): boolean {
  return token() !== null;
}

export class GeocodeError extends Error {}

/**
 * Greater Milan and its hinterland (Monza, Como, Bergamo, Pavia).
 *
 * A hard bound, not just a bias: `proximity` alone is only a tiebreaker, and it
 * loses to an exact match elsewhere. "Via Sarfatti 25, Milano" resolved to
 * Asiago (200km away) because Milan's street is really "Via Roberto Sarfatti",
 * so the literal match won. Searching inside this box first prevents that; we
 * retry unbounded only if nothing is found here.
 */
const MILAN_BBOX = "8.4,45.0,10.0,46.0";

interface Candidate extends GeocodeResult {
  /** Municipality Mapbox placed this in, e.g. "Milano". */
  place: string;
  /** Mapbox granularity: "address", "street", "place", "region", … */
  featureType: string;
}

/**
 * Granularities precise enough to pin a venue. A "place" result is the centre
 * of a whole town — for gibberish like "asdkjh, Milano" Mapbox happily returns
 * the Duomo, which would look like a real pin while being meaningless.
 */
const PRECISE_TYPES = new Set(["address", "street", "poi", "postcode", "neighborhood"]);

function buildUrl(query: string, accessToken: string, bbox?: string): URL {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", accessToken);
  // Several candidates, because the top hit is often an exact street-name match
  // in the wrong town; we re-rank below.
  url.searchParams.set("limit", "5");
  url.searchParams.set("country", "it");
  url.searchParams.set("proximity", `${BOCCONI_CAMPUS.longitude},${BOCCONI_CAMPUS.latitude}`);
  if (bbox) url.searchParams.set("bbox", bbox);
  return url;
}

async function fetchCandidates(url: URL): Promise<Candidate[]> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new GeocodeError("Couldn't reach the address lookup service.");
  }
  if (!res.ok) throw new GeocodeError(`Address lookup failed (${res.status}).`);

  const body = (await res.json()) as {
    features?: {
      properties?: {
        full_address?: string;
        name?: string;
        coordinates?: { latitude?: number; longitude?: number };
        context?: { place?: { name?: string }; locality?: { name?: string } };
        feature_type?: string;
      };
    }[];
  };

  const out: Candidate[] = [];
  for (const f of body.features ?? []) {
    const p = f.properties;
    const lat = p?.coordinates?.latitude;
    const lng = p?.coordinates?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const featureType = p?.feature_type ?? "";
    // Drop town/region-level hits: too coarse to be a venue's pin.
    if (featureType && !PRECISE_TYPES.has(featureType)) continue;
    out.push({
      latitude: lat,
      longitude: lng,
      matchedAddress: p?.full_address ?? p?.name ?? "",
      place: p?.context?.place?.name ?? p?.context?.locality?.name ?? "",
      featureType,
    });
  }
  return out;
}

/** Rough distance in km — good enough for ranking candidates. */
function distanceKm(lat: number, lng: number): number {
  const dLat = (lat - BOCCONI_CAMPUS.latitude) * 111.32;
  const dLng =
    (lng - BOCCONI_CAMPUS.longitude) * 111.32 * Math.cos((BOCCONI_CAMPUS.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** The town named in the address, if any — usually the last comma-separated part. */
function statedCity(query: string): string | null {
  const parts = query
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = parts.at(-1);
  // A trailing house number or postcode isn't a city.
  if (!last || /^\d+$/.test(last)) return null;
  return last.replace(/^\d{5}\s*/, "").toLowerCase() || null;
}

function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Mapbox mixes the Italian and English exonyms across fields. */
const CITY_ALIASES: Record<string, string> = { milan: "milano", milano: "milano" };
const canonicalCity = (s: string) => {
  const n = normalise(s);
  return CITY_ALIASES[n] ?? n;
};

/**
 * Pick the best candidate.
 *
 * Matching is done on the structured municipality only, never the address
 * string — "Via Milano Genova, Casatisma" and "Localita' Milano Fiori,
 * Rozzano" both contain "milano" and were being accepted as Milan addresses.
 *
 * When the admin named a town and nothing sits in it, we return null rather
 * than the nearest guess: a clear "no match" is far safer than silently
 * pinning a venue 40km away, which nobody would notice until a student did.
 */
function pickBest(candidates: Candidate[], query: string): Candidate | null {
  if (candidates.length === 0) return null;

  const city = statedCity(query);
  if (city) {
    const wanted = canonicalCity(city);
    const inCity = candidates.filter((c) => c.place && canonicalCity(c.place) === wanted);
    if (inCity.length === 0) return null;
    return inCity.reduce((best, c) =>
      distanceKm(c.latitude, c.longitude) < distanceKm(best.latitude, best.longitude) ? c : best,
    );
  }

  // No town given — fall back to whatever is closest to campus.
  return candidates.reduce((best, c) =>
    distanceKm(c.latitude, c.longitude) < distanceKm(best.latitude, best.longitude) ? c : best,
  );
}

/**
 * Resolve a free-text address to coordinates. Returns null when the address
 * simply has no match (a typo, or somewhere too vague) — callers treat that as
 * "no pin" rather than an error, so a partner can still be saved and listed.
 * Throws only when the lookup itself fails (missing token, network, API error).
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const accessToken = token();
  if (!accessToken) throw new GeocodeError("Mapbox token isn't configured on the server.");

  const query = address.trim();
  if (!query) return null;

  // Local first, so a literal match in another province can't outrank the
  // obvious Milan address. Only widen the search if that finds nothing.
  let candidates = await fetchCandidates(buildUrl(query, accessToken, MILAN_BBOX));
  if (candidates.length === 0) {
    candidates = await fetchCandidates(buildUrl(query, accessToken));
  }

  const hit = pickBest(candidates, query);
  if (!hit) return null;

  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    matchedAddress: hit.matchedAddress || query,
  };
}
