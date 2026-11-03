import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Card, StatCard } from "@/app/_ui/card";
import { romeDayKey } from "@/app/_ui/rome";
import { requireDashboardPage } from "../_lib/session";
import { RefreshButton } from "../users/refresh-button";
import { LineChart, PieChart, type Slice } from "./charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "BI" };

const DAYS = 60;

/** Count rows by a label, biggest first; everything past `keep` folds into "Other". */
function tally(labels: string[], keep = 8): Slice[] {
  const m = new Map<string, number>();
  for (const l of labels) m.set(l, (m.get(l) ?? 0) + 1);
  const sorted = [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, keep);
  const rest = sorted.slice(keep).reduce((a, s) => a + s.value, 0);
  return rest ? [...head, { label: "Other", value: rest }] : head;
}

export default async function BiPage() {
  await requireDashboardPage("bi");

  // An "install" is a student account: it is created the first time someone signs in to the app.
  const students = await prisma.user.findMany({
    where: { deletedAt: null, roles: { has: "STUDENT" } },
    select: {
      createdAt: true,
      academicProfile: {
        select: { studyYear: true, programme: { select: { code: true } } },
      },
    },
  });

  const perDay = new Map<string, number>();
  for (const s of students) {
    const k = romeDayKey(s.createdAt);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const series: { label: string; value: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const k = romeDayKey(new Date(Date.now() - i * 86_400_000));
    series.push({ label: k.slice(5), value: perDay.get(k) ?? 0 });
  }
  const last7 = series.slice(-7).reduce((a, p) => a + p.value, 0);
  const today = series.at(-1)?.value ?? 0;

  const withProfile = students.filter((s) => s.academicProfile);
  const byYear = tally(withProfile.map((s) => `Year ${s.academicProfile!.studyYear}`)).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const byCourse = tally(withProfile.map((s) => s.academicProfile!.programme.code));

  return (
    <>
      <PageHeader title="BI" subtitle="Installs and who they are. Updated every time you open or refresh this page." />
      <div className="mb-4">
        <RefreshButton />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Installs (total)" value={students.length.toLocaleString()} hint="Students who signed in" />
        <StatCard label="Today" value={today.toLocaleString()} />
        <StatCard label="Last 7 days" value={last7.toLocaleString()} />
        <StatCard
          label="Profile completed"
          value={students.length ? `${Math.round((withProfile.length / students.length) * 100)}%` : "—"}
          hint={`${withProfile.length.toLocaleString()} picked programme & year`}
        />
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Installs per day (last {DAYS} days, Milan time)</h2>
        <LineChart points={series} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-800">By study year</h2>
          <PieChart slices={byYear} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-800">By course (programme)</h2>
          <PieChart slices={byCourse} />
        </Card>
      </div>
    </>
  );
}
