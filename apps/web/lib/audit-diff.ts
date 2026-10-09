// Pure helpers behind lib/audit.ts (no imports, so the tests can load them).

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "unpublish";

const EMAIL = /[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g;

/**
 * Deep copy with every email address replaced by `hash(address)` (first 10 hex
 * chars) @ its domain: still tells domains apart, identifies nobody.
 */
export function scrubWith<T>(value: T, hash: (email: string) => string): T {
  if (typeof value === "string") {
    return value.replace(EMAIL, (match, domain: string) => `${hash(match).slice(0, 10)}@${domain}`) as T;
  }
  if (Array.isArray(value)) return value.map((v) => scrubWith(v, hash)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubWith(v, hash)]),
    ) as T;
  }
  return value;
}

const clip = (v: unknown): unknown =>
  typeof v === "string" && v.length > 80 ? `${v.slice(0, 80)}…` : v;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The fields among `keys` whose value differs, as { field: [before, after] }.
 * Long text is clipped so one edited article cannot bloat the log.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[],
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of keys) {
    if (!same(before[k], after[k])) out[k] = [clip(before[k] ?? null), clip(after[k] ?? null)];
  }
  return out;
}

/**
 * "publish"/"unpublish" when the visibility flag flipped and nothing else did,
 * otherwise "update". (Every save used to be logged as publish or unpublish
 * because the forms always send the flag.)
 */
export function auditVerb(changes: Record<string, unknown>, flag: string): AuditAction {
  const keys = Object.keys(changes);
  if (keys.length === 1 && keys[0] === flag) {
    const [, after] = changes[flag] as [unknown, unknown];
    return after ? "publish" : "unpublish";
  }
  return "update";
}
