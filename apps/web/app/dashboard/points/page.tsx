import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { StatCard } from "@/app/_ui/card";
import { Badge } from "@/app/_ui/badge";
import { AdjustPointsForm } from "./adjust-form";
import { romeDateTime } from "@/app/_ui/rome";
import { requireDashboardPage } from "../_lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Points" };

const RECENT = 25;

// Students who have not been deleted: the only accounts whose points count.
const LIVE_STUDENT = { deletedAt: null, roles: { has: "STUDENT" as const } };

const SOURCE_LABEL: Record<string, string> = {
  SIGNUP: "Signup",
  EVENT_CHECKIN: "Event check-in",
  PARTNER_SCAN: "Partner scan",
  REWARD_REDEMPTION: "Reward",
  ADMIN_ADJUSTMENT: "Manual",
  OTHER: "Other",
};

export default async function PointsPage() {
  await requireDashboardPage("points");
  const [aggregate, entries, holders] = await Promise.all([
    prisma.pointsLedgerEntry.aggregate({
      where: { user: LIVE_STUDENT },
      _sum: { delta: true },
      _count: { _all: true },
    }),
    prisma.pointsLedgerEntry.findMany({
      where: { user: LIVE_STUDENT },
      orderBy: { createdAt: "desc" },
      take: RECENT,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.user.count({ where: { ...LIVE_STUDENT, ledgerEntries: { some: {} } } }),
  ]);

  const inCirculation = aggregate._sum.delta ?? 0;

  return (
    <>
      <PageHeader
        title="Points"
        subtitle="Balances are derived from an append-only ledger — there is no editable balance field."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Points in circulation" value={inCirculation.toLocaleString()} hint="Net balance held by current students" />
        <StatCard label="Ledger entries" value={aggregate._count._all.toLocaleString()} />
        <StatCard label="Students with points" value={holders.toLocaleString()} />
      </div>

      <AdjustPointsForm />

      <h2 className="mb-2 mt-8 text-sm font-semibold text-gray-800">Recent activity</h2>
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          No points awarded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">When (Milan)</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {romeDateTime(e.createdAt)}
                  </td>
                  <td className="break-all px-4 py-3 text-gray-800">
                    {e.user?.name ?? e.user?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={e.source === "ADMIN_ADJUSTMENT" ? "brand" : "neutral"}>
                      {SOURCE_LABEL[e.source] ?? e.source}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.reason}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      e.delta >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
