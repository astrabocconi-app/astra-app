import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

// Client-side persistence of the student's course + academic year.
//
// TEMPORARY: stored only on-device (OS keychain) so it survives restarts. When
// the real programme list is provided and a `course`/`year` field is added to
// the User model, this should persist server-side via an API endpoint and the
// materials feed should filter by `course`. Until then this is local-only.
//
// TODO(course-list): replace COURSES with the official Bocconi programme list.

const COURSE_KEY = "astra_profile_course";
const YEAR_KEY = "astra_profile_year";

// Placeholder options — swap for the official list later.
export const COURSES: string[] = [
  "Economics & Management (CLEAM)",
  "International Economics & Management (BIEM)",
  "Economics & Finance (CLEF)",
  "International Economics & Finance (BIEF)",
  "Economics, Management & Computer Science (BEMACS)",
  "World Bachelor in Business (WBB)",
  "Economic & Social Sciences (CLES)",
  "Management (Master)",
  "Finance (Master)",
  "Data Science & Business Analytics (Master)",
];

export const YEARS: string[] = [
  "1st year",
  "2nd year",
  "3rd year",
  "1st year (Master)",
  "2nd year (Master)",
];

type ProfileState = {
  course: string | null;
  year: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCourse: (course: string) => Promise<void>;
  setYear: (year: string) => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set) => ({
  course: null,
  year: null,
  hydrated: false,
  hydrate: async () => {
    const [course, year] = await Promise.all([
      SecureStore.getItemAsync(COURSE_KEY),
      SecureStore.getItemAsync(YEAR_KEY),
    ]);
    set({ course: course ?? null, year: year ?? null, hydrated: true });
  },
  setCourse: async (course) => {
    await SecureStore.setItemAsync(COURSE_KEY, course);
    set({ course });
  },
  setYear: async (year) => {
    await SecureStore.setItemAsync(YEAR_KEY, year);
    set({ year });
  },
}));
