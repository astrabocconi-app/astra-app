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

// Bocconi programmes. Codes match the `subject` used by the materials/handouts
// feed so Materials can filter to the student's course. The profile shows the
// `code` (acronym); the picker shows the full name.
export const COURSES: { code: string; name: string }[] = [
  // ── Undergraduate ──
  { code: "BIEM", name: "International Economics & Management" },
  { code: "CLEAM", name: "Economia e Management" },
  { code: "BIEF", name: "International Economics & Finance" },
  { code: "BESS", name: "Economic & Social Sciences" },
  { code: "BEMACS", name: "Economics, Management & Computer Science" },
  { code: "BAI", name: "Mathematical & Computing Sciences for AI" },
  { code: "BIG", name: "International Politics & Government" },
  { code: "WBB", name: "World Bachelor in Business" },
  { code: "BGL", name: "Bachelor in Global Law" },
  { code: "CLEACC", name: "Management per l'Arte, la Cultura e la Comunicazione" },
  { code: "BEMACC", name: "Economics & Management for Arts, Culture, Media" },
  { code: "CLMG", name: "Giurisprudenza (ciclo unico, 5 anni)" },
  // ── Graduate (MSc) ──
  { code: "AFM", name: "MSc Accounting & Financial Management" },
  { code: "AI", name: "MSc Artificial Intelligence" },
  { code: "CYBER", name: "MSc Cyber Risk Strategy & Governance" },
  { code: "DAIHS", name: "MSc Data Analytics & AI in Health Sciences" },
  { code: "DSBA", name: "MSc Data Science & Business Analytics" },
  { code: "ESS", name: "MSc Economic & Social Sciences" },
  { code: "ACME", name: "MSc Economics & Management in Arts, Culture, Media & Entertainment" },
  { code: "GIO", name: "MSc Economics & Management of Gov't & Int'l Organizations" },
  { code: "FIN", name: "MSc Finance" },
  { code: "EMIT", name: "MSc Innovation, Technology & Entrepreneurship" },
  { code: "IM", name: "MSc International Management" },
  { code: "MM", name: "MSc Marketing Management" },
  { code: "PPA", name: "MSc Politics & Policy Analysis" },
  { code: "TS", name: "MSc Transformative Sustainability" },
  { code: "GLOBE", name: "MA Global Law for Organizations, Business & Institutions" },
];

// Render a stored course value as its acronym, whatever form it's in — a code
// ("BEMACS"), a "Full Name (CODE)" string (legacy), or a bare full name.
export function shortCourse(value: string | null): string | null {
  if (!value) return null;
  if (COURSES.some((c) => c.code === value)) return value;
  const paren = value.match(/\(([^)]+)\)/);
  if (paren?.[1]) return paren[1];
  const byName = COURSES.find((c) => value.includes(c.name));
  return byName ? byName.code : value;
}

export const YEARS: string[] = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year", // CLMG (Giurisprudenza) is a 5-year single-cycle degree
  "5th year",
  "1st year (Master)",
  "2nd year (Master)",
];

type ProfileState = {
  course: string | null;
  year: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCourse: (course: string) => void;
  setYear: (year: string) => void;
};

// ponytail: a failed write only means the choice doesn't survive a restart, and
// the user re-picks in two taps. Not worth a retry queue.
function persist(key: string, value: string) {
  void SecureStore.setItemAsync(key, value).catch((error) =>
    console.warn(`profile-store: could not persist ${key}`, error)
  );
}

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
  // The keychain write is a native round-trip; awaiting it before set() left the
  // picker visibly stuck on tap. Update state first, persist behind it.
  setCourse: (course) => {
    set({ course });
    persist(COURSE_KEY, course);
  },
  setYear: (year) => {
    set({ year });
    persist(YEAR_KEY, year);
  },
}));
