import * as SecureStore from "expo-secure-store";

// Old builds kept the course and year on the phone before the server stored
// them. Nothing reads these any more (the iOS keychain outlives reinstalls, so
// migrating them could hand one person's programme to the next account on the
// phone), they are just removed at boot.
const COURSE_KEY = "astra_profile_course";
const YEAR_KEY = "astra_profile_year";

export async function clearLegacyAcademicProfile(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(COURSE_KEY),
    SecureStore.deleteItemAsync(YEAR_KEY),
  ]);
}
