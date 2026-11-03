// Cross-check app accounts against class rosters by name. Pure, no I/O.
//
// Rosters hold "FIRST [MIDDLE] LAST" in capitals; students type their name however
// they like (order swapped, lower case, accents dropped) and some accounts have no
// name at all, only an email like mario.rossi@studbocconi.it. So names are compared
// as unordered sets of normalised words, and the email's local part is a second
// source of words.

export interface RosterFile {
  course: string;
  classes: { year: string; path: string; students: string[] }[];
}

export interface RosterEntry {
  course: string;
  /** 1-3, from "Primo/Secondo/Terzo anno". 0 if unrecognised. */
  year: number;
  /** Class number ("40", "1"), or "—" for a programme year with one class. */
  classCode: string;
  tokens: string[];
}

export interface Account {
  name: string | null;
  email: string;
  /** Programme code and study year from the app profile; only used to break ties. */
  hint?: { course: string; year: number } | null;
}

const YEARS: Record<string, number> = { primo: 1, secondo: 2, terzo: 3 };

/** Lower case, accents stripped, punctuation gone, initials and noise dropped. */
export function nameTokens(raw: string): string[] {
  const cleaned = raw
    .replace(/_?preview\s*user/gi, " ")
    .replace(/\\_/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ");
  return [...new Set(cleaned.split(/\s+/).filter((t) => t.length >= 2))];
}

/** "mario.rossi7@studbocconi.it" -> ["mario", "rossi"]. */
export function emailTokens(email: string): string[] {
  return nameTokens((email.split("@")[0] ?? "").replace(/[._-]+/g, " "));
}

export function flattenRosters(files: RosterFile[]): RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const f of files) {
    for (const c of f.classes) {
      const year = YEARS[c.year.trim().split(/\s+/)[0]?.toLowerCase() ?? ""] ?? 0;
      const last = c.path.split("/").pop() ?? "";
      const num = /(\d+)\s*$/.exec(last)?.[1];
      const classCode = c.path.includes("/") && num ? num : "—";
      for (const s of c.students) {
        const tokens = nameTokens(s);
        if (tokens.length >= 2) out.push({ course: f.course, year, classCode, tokens });
      }
    }
  }
  return out;
}

/** 2 = same words, 1 = the shorter name's words all appear in the longer (>= 2 words), 0 = no. */
function score(a: string[], b: string[]): 0 | 1 | 2 {
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  if (small.length < 2) return 0;
  const bigSet = new Set(big);
  if (!small.every((t) => bigSet.has(t))) return 0;
  return small.length === big.length ? 2 : 1;
}

export interface MatchResult {
  /** installed[i] is true when roster entry i has a matching account. */
  installed: boolean[];
  matchedAccounts: number;
  ambiguousAccounts: number;
  unmatchedAccounts: number;
}

/**
 * An account counts only when it points at exactly one roster entry at its best
 * score; two equally good candidates (two "Marco Rossi") are settled by the
 * account's own programme and year if that picks one, else reported as
 * ambiguous instead of guessing, so the percentages are never inflated.
 */
export function matchAccounts(entries: RosterEntry[], accounts: Account[]): MatchResult {
  const byToken = new Map<string, number[]>();
  entries.forEach((e, i) => {
    for (const t of e.tokens) (byToken.get(t) ?? byToken.set(t, []).get(t)!).push(i);
  });

  const installed = new Array<boolean>(entries.length).fill(false);
  let matchedAccounts = 0;
  let ambiguousAccounts = 0;

  for (const acc of accounts) {
    const sources = [acc.name ? nameTokens(acc.name) : [], emailTokens(acc.email)];
    let best = 0;
    let hits = new Set<number>();
    for (const toks of sources) {
      if (toks.length < 2) continue;
      const candidates = new Set<number>();
      for (const t of toks) for (const i of byToken.get(t) ?? []) candidates.add(i);
      for (const i of candidates) {
        const s = score(toks, entries[i]!.tokens);
        if (s > best) {
          best = s;
          hits = new Set([i]);
        } else if (s === best && s > 0) hits.add(i);
      }
    }
    if (best === 0) continue;
    if (hits.size > 1 && acc.hint) {
      const h = acc.hint;
      const narrowed = [...hits].filter((i) => entries[i]!.course.toLowerCase() === h.course.toLowerCase() && entries[i]!.year === h.year);
      if (narrowed.length === 1) hits = new Set(narrowed);
    }
    if (hits.size === 1) {
      installed[[...hits][0]!] = true;
      matchedAccounts++;
    } else ambiguousAccounts++;
  }
  return { installed, matchedAccounts, ambiguousAccounts, unmatchedAccounts: accounts.length - matchedAccounts - ambiguousAccounts };
}
