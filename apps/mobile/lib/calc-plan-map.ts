// Which calculator plan serves a catalogue programme (and track). Pure, so it
// can be tested against the real catalogue codes.

// Catalogue programme codes that differ from the plan keys (old names of a
// programme, or one plan serving two codes). Management ("M") is NOT an alias
// of Marketing Management, and WBB / BIEMF have no plan at all.
const ALIASES: Record<string, string> = {
  FIN: "FINANCE",
  "CLEFIN-FINANCE": "FINANCE",
  DAIHS: "DAAIHS",
  CYBER: "CRSG",
  AFC: "AFM",
  CLAPI: "GIO",
  "DES-ESS": "ESS",
  "BESS-CLES": "BESS",
  BEMACC: "CLEACC-ENG",
};

// Track codes that name a plan directly, or differ from the plan's suffix.
const TRACK_PLAN: Record<string, string> = {
  "CLEACC:ITA": "CLEACC",
  "CLEACC:ENG": "CLEACC-ENG",
  "BIG:PPM": "BIG",
  "BIG:DSO": "BIG-DSO",
  "BGL:GL": "BGL-GL",
  "BGL:DL": "BGL-DL",
  "FIN:FINANCE": "FINANCE",
  "FIN:GLOBAL": "FINANCE-GLOBAL",
  "IM:GLOBAL": "IM-GLOBAL",
  "IM:CONCENTRATIONS": "IM-CONCENTRATION",
  // CEMS students follow the Global Experience year; the closest plan we have.
  "IM:CEMS": "IM-GLOBAL",
};

// Plans that exist but are never a default for anyone (old, unverifiable).
const NEVER_DEFAULT = new Set(["IM"]);

/**
 * The plan key for a programme code and track code among `keys`, or null when
 * there is none (or several equally good ones): the screen then asks.
 */
export function pickPlan(keys: string[], code: string | undefined, track: string | undefined): string | null {
  const has = (k: string | undefined): k is string => !!k && keys.includes(k) && !NEVER_DEFAULT.has(k);
  if (!code) return null;
  const base = ALIASES[code] ?? code;
  if (track) {
    const candidates = [TRACK_PLAN[`${code}:${track}`], track, `${base}-${track}`];
    for (const c of candidates) if (has(c)) return c;
  }
  if (has(base)) return base;
  const prefixed = keys.filter((k) => k.startsWith(`${base}-`) && has(k));
  return prefixed.length === 1 ? prefixed[0]! : null;
}
