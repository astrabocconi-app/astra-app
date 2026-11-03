import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Card, StatCard } from "@/app/_ui/card";
import { r2GetText, R2NotConfigured } from "@/lib/r2";
import { flattenRosters, matchAccounts, type RosterFile } from "@/lib/roster-match";
import { requireDashboardPage } from "../../_lib/session";
import { RefreshButton } from "../../users/refresh-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class coverage" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-astra-primary" style={{ width: `${value}%` }} />
    </div>
  );
}

export default async function ClassCoveragePage() {
  await requireDashboardPage("bi-classes");

  let files: RosterFile[];
  try {
    files = JSON.parse(await r2GetText("db/rosters.json"));
  } catch (e) {
    return (
      <>
        <PageHeader title="Class coverage" subtitle="Share of each class roster that has installed the app." />
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {e instanceof R2NotConfigured
            ? "Rosters can't be read yet: set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY on this Vercel project."
            : `Couldn't load db/rosters.json from Cloudflare R2 (${e instanceof Error ? e.message : "unknown error"}).`}
        </p>
      </>
    );
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null, roles: { has: "STUDENT" } },
    select: {
      name: true,
      email: true,
      academicProfile: { select: { studyYear: true, programme: { select: { code: true } } } },
    },
  });

  const entries = flattenRosters(files);
  const result = matchAccounts(
    entries,
    users.map((u) => ({
      name: u.name,
      email: u.email,
      hint: u.academicProfile && { course: u.academicProfile.programme.code, year: u.academicProfile.studyYear },
    })),
  );

  // course -> class key -> counts
  type Row = { year: number; classCode: string; total: number; installed: number };
  const courses = new Map<string, Map<string, Row>>();
  entries.forEach((e, i) => {
    const classes = courses.get(e.course) ?? courses.set(e.course, new Map()).get(e.course)!;
    const key = `${e.year}/${e.classCode}`;
    const row = classes.get(key) ?? classes.set(key, { year: e.year, classCode: e.classCode, total: 0, installed: 0 }).get(key)!;
    row.total++;
    if (result.installed[i]) row.installed++;
  });

  const installedTotal = result.installed.filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Class coverage"
        subtitle="Roster names (Cloudflare R2) matched to app accounts by name, ignoring case, accents and word order."
      />
      <div className="mb-4">
        <RefreshButton />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="On rosters" value={entries.length.toLocaleString()} />
        <StatCard label="Installed" value={`${pct(installedTotal, entries.length)}%`} hint={`${installedTotal.toLocaleString()} roster students matched`} />
        <StatCard label="Accounts not on a roster" value={result.unmatchedAccounts.toLocaleString()} hint="No name match: other cohorts, or a name that differs" />
        <StatCard label="Ambiguous accounts" value={result.ambiguousAccounts.toLocaleString()} hint="Same name on several rosters; not counted" />
      </div>

      <div className="flex flex-col gap-6">
        {[...courses].map(([course, classes]) => {
          const rows = [...classes.values()].sort((a, b) => a.year - b.year || a.classCode.localeCompare(b.classCode, undefined, { numeric: true }));
          const total = rows.reduce((a, r) => a + r.total, 0);
          const inst = rows.reduce((a, r) => a + r.installed, 0);
          return (
            <Card key={course}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-800">{course}</h2>
                <span className="text-sm text-gray-500">
                  {inst.toLocaleString()} / {total.toLocaleString()} · <span className="font-semibold text-gray-800">{pct(inst, total)}%</span>
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-1.5 font-medium">Year</th>
                    <th className="py-1.5 font-medium">Class</th>
                    <th className="py-1.5 text-right font-medium">Roster</th>
                    <th className="py-1.5 text-right font-medium">Installed</th>
                    <th className="py-1.5 pl-4 font-medium">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={`${r.year}/${r.classCode}`}>
                      <td className="py-1.5 text-gray-700">{r.year || "?"}</td>
                      <td className="py-1.5 text-gray-700">{r.classCode}</td>
                      <td className="py-1.5 text-right text-gray-700">{r.total}</td>
                      <td className="py-1.5 text-right text-gray-700">{r.installed}</td>
                      <td className="py-1.5 pl-4">
                        <span className="flex items-center gap-2">
                          <Bar value={pct(r.installed, r.total)} />
                          <span className="w-9 text-right font-medium text-gray-800">{pct(r.installed, r.total)}%</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </>
  );
}
