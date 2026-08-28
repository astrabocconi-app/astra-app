import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { UsersIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  STAFF: "Staff",
  AREA_MANAGER: "Area manager",
  ADMIN: "Admin",
  PARTNER_MANAGER: "Partner",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              { name: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { academicProfile: { include: { programme: true } } },
  });

  // Balances come from the append-only ledger, so read them in one grouped
  // query rather than N per-user lookups.
  const balances = await prisma.pointsLedgerEntry.groupBy({
    by: ["userId"],
    _sum: { delta: true },
    where: { userId: { in: rows.map((r) => r.id) } },
  });
  const balanceByUser = new Map(balances.map((b) => [b.userId, b._sum.delta ?? 0]));

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`Students who have signed in. Venue accounts live under Partner logins. Showing up to ${PAGE_SIZE}.`}
      />

      <form method="GET" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name or email…"
          className="w-full max-w-sm rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-astra-accent"
        />
        <button
          type="submit"
          className="rounded-xl bg-astra-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Search
        </button>
        {query && (
          <a
            href="/dashboard/users"
            className="self-center text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </a>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={28} />}
          title={query ? "No matches" : "No users yet"}
          description={
            query
              ? `Nothing matched “${query}”.`
              : "Students appear here automatically the first time they sign in to the app."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Programme</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((u) => {
                const academic = u.academicProfile;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-gray-900">{u.name ?? "—"}</span>
                      <span className="block text-xs text-gray-500">{u.email}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {academic
                        ? `${academic.programme.code} · Year ${academic.studyYear}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {(balanceByUser.get(u.id) ?? 0).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {fmt.format(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} tone={r === "ADMIN" ? "brand" : "neutral"}>
                            {ROLE_LABEL[r] ?? r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
