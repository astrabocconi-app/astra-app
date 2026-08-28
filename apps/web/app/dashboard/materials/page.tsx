import { PageHeader } from "@/app/_ui/page-header";
import { Badge } from "@/app/_ui/badge";
import { StatCard } from "@/app/_ui/card";
import { EmptyState } from "@/app/_ui/empty-state";
import { BookIcon } from "@/app/_ui/icons";
import { fetchMaterials, isConfigured } from "@/lib/materials";

export const dynamic = "force-dynamic";

/**
 * Read-only view of the handout catalogue.
 *
 * Deliberately NOT backed by the Prisma `Material` model — nothing reads that
 * table, so editing it would change nothing in the app. The real source is the
 * Supabase `handouts` / `clmg_handouts` catalogue that /api/materials serves,
 * which is what this page shows, so what you see here is exactly what students
 * get. Uploading/editing files means writing to Supabase Storage; until that's
 * built, files are managed at astrabocconi.com/dispense.
 */
export default async function MaterialsPage() {
  if (!isConfigured()) {
    return (
      <>
        <PageHeader title="Materials" subtitle="Handouts and dispense students can download." />
        <EmptyState
          icon={<BookIcon size={28} />}
          title="Materials aren't configured"
          description="Set SUPABASE_URL and SUPABASE_SECRET_KEY on the web app to read the handout catalogue."
        />
      </>
    );
  }

  let years;
  try {
    years = await fetchMaterials();
  } catch (e) {
    return (
      <>
        <PageHeader title="Materials" subtitle="Handouts and dispense students can download." />
        <EmptyState
          icon={<BookIcon size={28} />}
          title="Couldn't load the catalogue"
          description={e instanceof Error ? e.message : "The materials source didn't respond."}
        />
      </>
    );
  }

  const totalFiles = years.reduce((n, y) => n + y.count, 0);
  const totalSubjects = years.reduce((n, y) => n + y.subjects.length, 0);

  return (
    <>
      <PageHeader
        title="Materials"
        subtitle="Live view of the handout catalogue students see in the app."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Files" value={totalFiles.toLocaleString()} />
        <StatCard label="Subjects" value={totalSubjects.toLocaleString()} />
        <StatCard label="Years" value={years.length.toLocaleString()} />
      </div>

      <p className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-500">
        Read-only. These files live in the shared Supabase catalogue rather than in this dashboard,
        and the app reads them live — so anything added there reaches students without an app
        update. Files are currently managed at{" "}
        <a
          href="https://www.astrabocconi.com/dispense"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-astra-accent hover:underline"
        >
          astrabocconi.com/dispense
        </a>
        . Tell me if you want upload and delete built in here too.
      </p>

      {years.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={28} />}
          title="No materials yet"
          description="The handout catalogue is empty."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {years.map((y) => (
            <section key={y.year} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-800">{y.year}</h2>
                <span className="text-xs text-gray-400">
                  {y.count === 1 ? "1 file" : `${y.count} files`}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {y.subjects.map((s) => (
                      <tr key={`${y.year}-${s.subject}`} className="align-top">
                        <td className="w-48 px-4 py-3">
                          <Badge tone="neutral">{s.subject}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ul className="flex flex-col gap-1">
                            {s.items.map((it) => (
                              <li key={String(it.id)}>
                                <a
                                  href={it.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-gray-700 hover:text-astra-accent hover:underline"
                                >
                                  {it.title.replace(/\.pdf$/i, "")}
                                </a>
                                {(it.semester || it.examType) && (
                                  <span className="ml-2 text-xs text-gray-400">
                                    {[it.examType, it.semester].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
