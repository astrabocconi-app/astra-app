import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Badge } from "@/app/_ui/badge";
import { Button } from "@/app/_ui/button";
import { EmptyState } from "@/app/_ui/empty-state";
import { UsersIcon } from "@/app/_ui/icons";
import { Input } from "@/app/_ui/field";
import { romeDate } from "@/app/_ui/rome";
import { isAdmin } from "@/lib/authz";
import { requireDashboardPage } from "../_lib/session";
import { DeleteUserButton } from "./delete-user-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students" };

const PAGE_SIZE = 50;

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  STAFF: "Staff",
  AREA_MANAGER: "Area manager",
  ADMIN: "Admin",
  PARTNER_MANAGER: "Partner",
};

function pageHref(query: string, page: number) {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/dashboard/users${qs ? `?${qs}` : ""}`;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  // Deleting accounts is the admin's call, not a staff account granted Users.
  const session = await requireDashboardPage("users");
  const canDelete = isAdmin(session.actor);
  const query = q?.trim() ?? "";

  // Students only: venue logins and staff have their own pages.
  const where = {
    deletedAt: null,
    roles: { has: "STUDENT" as const },
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.user.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(pageParam)) || 1));

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { academicProfile: { include: { programme: true, track: true, classGroup: true } } },
  });

  // Balances come from the append-only ledger, so read them in one grouped
  // query rather than N per-user lookups.
  const balances = await prisma.pointsLedgerEntry.groupBy({
    by: ["userId"],
    _sum: { delta: true },
    where: { userId: { in: rows.map((r) => r.id) } },
  });
  const balanceByUser = new Map(balances.map((b) => [b.userId, b._sum.delta ?? 0]));

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + rows.length;

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${total.toLocaleString()} ${total === 1 ? "student" : "students"}${
          query ? ` match “${query}”` : " have signed in"
        }. Venue accounts live under Venue logins, staff under Team.`}
      />

      <form method="GET" role="search" className="mb-4 flex gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name or email…"
          aria-label="Search students"
          className="max-w-sm"
        />
        <Button type="submit">Search</Button>
        {query && (
          <Link href="/dashboard/users" className="self-center text-sm text-gray-500 hover:text-gray-700">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={28} />}
          title={query ? "No matches" : "No students yet"}
          description={
            query
              ? `Nothing matched “${query}”.`
              : "Students appear here automatically the first time they sign in to the app."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Programme</th>
                  <th className="px-4 py-3 font-medium">Points</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  {canDelete && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((u) => {
                  const academic = u.academicProfile;
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-gray-900">{u.name ?? "—"}</span>
                        <span className="block break-all text-xs text-gray-500">{u.email}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {academic
                          ? [
                              academic.programme.code,
                              academic.track?.code,
                              `Year ${academic.studyYear}`,
                              academic.classGroup ? `Class ${academic.classGroup.code}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {(balanceByUser.get(u.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">{romeDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r} tone={r === "ADMIN" ? "brand" : "neutral"}>
                              {ROLE_LABEL[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      {canDelete && (
                        <td className="px-4 py-3 text-right">
                          {/* Students only: staff are revoked from Team, venue logins from Venue logins. */}
                          {u.id !== session.user.id && u.roles.includes("STUDENT") && !u.roles.includes("ADMIN") && (
                            <DeleteUserButton id={u.id} email={u.email} />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-gray-500">
              Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
            </p>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(query, page - 1)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                ) : null}
                <span className="text-gray-500">
                  Page {page} of {pages}
                </span>
                {page < pages ? (
                  <Link
                    href={pageHref(query, page + 1)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            )}
          </nav>
        </>
      )}
    </>
  );
}
