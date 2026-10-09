// Academic-year rollover (no imports, so node:test can load it).
//
// Bocconi's year starts in September. A programme selection last touched
// before that September is probably a year out of date, so the Academics tab
// asks the student whether they are still in the same year.

/** The September 1st that opened the academic year `now` falls in (UTC; a day either way is irrelevant). */
export function academicYearStart(now: Date): Date {
  const y = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 8, 1));
}

/** Stable id of that academic year, e.g. "2026" for 2026/27. Used to remember a dismissal. */
export function academicYearId(now: Date): string {
  return String(academicYearStart(now).getUTCFullYear());
}

export function profileNeedsYearCheck(updatedAtIso: string, now: Date): boolean {
  const updated = Date.parse(updatedAtIso);
  return Number.isFinite(updated) && updated < academicYearStart(now).getTime();
}
