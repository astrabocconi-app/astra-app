// Materials (dispense/handouts). SERVER-ONLY.
//
// The handouts live in Supabase Storage and are catalogued in the `handouts`
// table. We read that table live with the SECRET key (kept server-side) so the
// mobile app never holds a key and stays light — it just opens the file_urls.

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

export interface MaterialItem {
  id: number | string;
  title: string;
  url: string;
  semester: string | null;
  examType: string | null;
}
export interface MaterialSubject {
  subject: string;
  items: MaterialItem[];
}
export interface MaterialYear {
  year: string;
  count: number;
  subjects: MaterialSubject[];
}

interface HandoutRow {
  id: number | string;
  year: string | null;
  subject: string | null;
  filename: string | null;
  file_url: string | null;
  semester: string | number | null;
  exam_type: string | number | null;
}

// CLMG (Giurisprudenza) handouts live in a separate table with a different shape.
interface ClmgRow {
  id: string;
  name: string | null;
  course_year: string | number | null;
  url: string | null;
  semester: string | number | null;
  exam_type: string | number | null;
}

async function fetchTable<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    next: { revalidate: 60 },
  });
  if (!res.ok)
    throw new Error(`Supabase ${table} ${res.status}: ${await res.text().catch(() => "")}`);
  return (await res.json()) as T[];
}

function yearFromNumber(v: string | number | null): string | null {
  const n = String(v ?? "").trim();
  if (n.startsWith("1")) return "First Year";
  if (n.startsWith("2")) return "Second Year";
  if (n.startsWith("3")) return "Third Year";
  if (n.startsWith("4")) return "Fourth Year";
  if (n.startsWith("5")) return "Fifth Year";
  return null;
}

// CLMG (Giurisprudenza) is a 5-year single-cycle degree, so 4th/5th years exist.
const YEAR_ORDER = ["First Year", "Second Year", "Third Year", "Fourth Year", "Fifth Year"];

function normYear(y: string | null): string | null {
  const s = (y ?? "").trim().toLowerCase();
  if (s.startsWith("first") || s.startsWith("1")) return "First Year";
  if (s.startsWith("second") || s.startsWith("2")) return "Second Year";
  if (s.startsWith("third") || s.startsWith("3")) return "Third Year";
  return null; // drop NULL / unknown years
}

function normSubject(s: string | null): string {
  const t = (s ?? "").trim();
  if (!t) return "Other";
  if (t.toLowerCase() === "languages") return "Languages";
  return t; // program codes (BEMACS…) are already uppercase
}

export function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

const str = (v: unknown) => (v == null ? null : String(v).trim() || null);

/** Read the handouts tables live and shape them into year → subject → items. */
export async function fetchMaterials(): Promise<MaterialYear[]> {
  const [handouts, clmg] = await Promise.all([
    fetchTable<HandoutRow>(
      "handouts",
      "select=id,year,subject,filename,file_url,semester,exam_type&order=subject"
    ),
    // CLMG (Giurisprudenza) — separate table/shape, folded in as the CLMG subject.
    fetchTable<ClmgRow>("clmg_handouts", "select=id,name,course_year,url,semester,exam_type").catch(
      () => [] as ClmgRow[]
    ),
  ]);

  // year -> subject -> items
  const byYear = new Map<string, Map<string, MaterialItem[]>>();
  const push = (year: string, subject: string, item: MaterialItem) => {
    if (!byYear.has(year)) byYear.set(year, new Map());
    const subjects = byYear.get(year)!;
    if (!subjects.has(subject)) subjects.set(subject, []);
    subjects.get(subject)!.push(item);
  };

  for (const r of handouts) {
    const url = (r.file_url ?? "").trim();
    if (!url.startsWith("http")) continue;
    const year = normYear(r.year);
    if (!year) continue;
    push(year, normSubject(r.subject), {
      id: r.id,
      title: str(r.filename) ?? "Untitled",
      url,
      semester: str(r.semester),
      examType: str(r.exam_type),
    });
  }

  for (const r of clmg) {
    const url = (r.url ?? "").trim();
    if (!url.startsWith("http")) continue;
    const year = yearFromNumber(r.course_year);
    if (!year) continue;
    push(year, "CLMG", {
      id: r.id,
      title: str(r.name) ?? "Untitled",
      url,
      semester: str(r.semester),
      examType: str(r.exam_type),
    });
  }

  return [...byYear.entries()]
    .sort((a, b) => YEAR_ORDER.indexOf(a[0]) - YEAR_ORDER.indexOf(b[0]))
    .map(([year, subjects]) => {
      const subjectList = [...subjects.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([subject, items]) => ({
          subject,
          items: items.sort((a, b) => a.title.localeCompare(b.title)),
        }));
      const count = subjectList.reduce((n, s) => n + s.items.length, 0);
      return { year, count, subjects: subjectList };
    });
}

const PROFILE_YEAR = ["First Year", "Second Year", "Third Year", "Fourth Year", "Fifth Year"];

/** Limit the catalogue to the signed-in student's saved programme and study year. */
export function filterMaterialsForAcademicProfile(
  years: MaterialYear[],
  programmeCode: string,
  studyYear: number,
  /**
   * Return every year of the student's programme instead of just their own.
   * Students revisit earlier years' handouts when resitting or revising, and
   * look ahead before choosing electives.
   */
  options?: { allYears?: boolean }
): MaterialYear[] {
  const year = PROFILE_YEAR[studyYear - 1];
  if (!options?.allYears && !year) return [];
  return years
    .filter((entry) => (options?.allYears ? true : entry.year === year))
    .map((entry) => {
      const subjects = entry.subjects.filter(
        (subject) =>
          subject.subject === programmeCode || subject.subject.split("-").includes(programmeCode)
      );
      return {
        ...entry,
        count: subjects.reduce((total, subject) => total + subject.items.length, 0),
        subjects,
      };
    })
    .filter((entry) => entry.count > 0);
}
