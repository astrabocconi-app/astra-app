import * as SecureStore from "expo-secure-store";

// Legacy on-device academic selection. Phase 3A reads this once, writes a
// server-authoritative profile, then removes the local values.
const COURSE_KEY = "astra_profile_course";
const YEAR_KEY = "astra_profile_year";

export async function loadLegacyAcademicProfile(): Promise<{
  programmeCode: string | null;
  studyYear: number | null;
}> {
  const [storedCourse, storedYear] = await Promise.all([
    SecureStore.getItemAsync(COURSE_KEY),
    SecureStore.getItemAsync(YEAR_KEY),
  ]);
  const parenthesized = storedCourse?.match(/\(([^)]+)\)/)?.[1];
  const year = Number.parseInt(storedYear ?? "", 10);
  return {
    programmeCode: parenthesized ?? storedCourse,
    studyYear: Number.isInteger(year) && year > 0 ? year : null,
  };
}

export async function clearLegacyAcademicProfile(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(COURSE_KEY),
    SecureStore.deleteItemAsync(YEAR_KEY),
  ]);
}
