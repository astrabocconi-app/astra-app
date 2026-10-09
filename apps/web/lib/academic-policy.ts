// Pure academic-selection rules. SERVER-ONLY (no imports, so tests can load it).

/** Natural order for class-group codes: "8" before "10" (a text sort gives 10, 8, 9). */
export function compareClassGroupCodes(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

/**
 * Must the student pick a track? Yes when the programme has an active track they
 * are already old enough to choose (BIEF splits from year 2, BGL from year 3).
 * Without one the calculator silently guesses the wrong plan.
 */
export function trackRequired(
  tracks: readonly { active: boolean; fromYear: number }[],
  studyYear: number,
): boolean {
  return tracks.some((t) => t.active && t.fromYear <= studyYear);
}
