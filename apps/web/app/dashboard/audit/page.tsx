import Link from "next/link";
import { prisma } from "@astra/db";
import { romeInputToIso } from "@astra/shared";
import { PageHeader } from "@/app/_ui/page-header";
import { Badge } from "@/app/_ui/badge";
import { Button } from "@/app/_ui/button";
import { EmptyState } from "@/app/_ui/empty-state";
import { Input, Select } from "@/app/_ui/field";
import { AuditIcon } from "@/app/_ui/icons";
import { romeDateTime } from "@/app/_ui/rome";
import { requireDashboardPage } from "../_lib/session";
import { describeAction, describeTarget, summarise, fieldChanges } from "./format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Params = { actor?: string; type?: string; from?: string; to?: string; page?: string };

function href(p: Params, page: number) {
  const q = new URLSearchParams();
  if (p.actor) q.set("actor", p.actor);
  if (p.type) q.set("type", p.type);
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `/dashboard/audit${s ? `?${s}` : ""}`;
}

/** The day after a YYYY-MM-DD, as YYYY-MM-DD (so "to" includes the whole last day). */
function nextDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireDashboardPage("audit");
  const params = await searchParams;
  const actor = params.actor?.trim() || "";
  const type = params.type?.trim() || "";
  const from = DAY_RE.test(params.from ?? "") ? params.from! : "";
  const to = DAY_RE.test(params.to ?? "") ? params.to! : "";

  // Day boundaries are Milan midnights, like every other date in the backoffice.
  const createdAt = {
    ...(from ? { gte: new Date(romeInputToIso(`${from}T00:00`)) } : {}),
    ...(to ? { lt: new Date(romeInputToIso(`${nextDay(to)}T00:00`)) } : {}),
  };
  const where = {
    ...(actor ? { actorId: actor } : {}),
    ...(type ? { targetType: type } : {}),
    ...(from || to ? { createdAt } : {}),
  };

  const [total, actorGroups, typeGroups] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["actorId"], where: { actorId: { not: null } } }),
    prisma.auditLog.groupBy({ by: ["targetType"], where: { targetType: { not: null } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.page)) || 1));

  const [rows, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true, staffUsername: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: actorGroups.map((g) => g.actorId!).filter(Boolean) } },
      select: { id: true, name: true, email: true, staffUsername: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const types = typeGroups.map((g) => g.targetType!).filter(Boolean).sort();
  const filtered = Boolean(actor || type || from || to);
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Who changed what. Append-only — entries are never edited or removed. Times are Milan time."
      />

      <form method="GET" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Who
          <Select name="actor" defaultValue={actor}>
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.staffUsername ?? a.email}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          What
          <Select name="type" defaultValue={type}>
            <option value="">Anything</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {describeTarget(t)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          From
          <Input type="date" name="from" defaultValue={from} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          To
          <Input type="date" name="to" defaultValue={to} />
        </label>
        <Button type="submit">Filter</Button>
        {filtered && (
          <Link href="/dashboard/audit" className="self-center pb-1 text-sm text-gray-500 hover:text-gray-700">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<AuditIcon size={28} />}
          title={filtered ? "Nothing matches those filters" : "Nothing logged yet"}
          description={
            filtered
              ? "Try a wider date range or clear a filter."
              : "Every create, edit, publish and delete made from this dashboard will be recorded here."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const who = r.actor?.name ?? r.actor?.staffUsername ?? r.actor?.email ?? "Unknown";
                  const detail = summarise(r.metadata);
                  const changes = fieldChanges(r.metadata);
                  const act = describeAction(r.action);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">{romeDateTime(r.createdAt)}</td>
                      <td className="break-all px-4 py-3 text-gray-800">{who}</td>
                      <td className="px-4 py-3">
                        <Badge tone={act.destructive ? "neutral" : "brand"}>{act.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="font-medium">{r.targetType ? describeTarget(r.targetType) : "—"}</span>
                        {detail && <span className="break-words text-gray-500"> · {detail}</span>}
                        {changes.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                            {changes.map((c) => (
                              <li key={c.field} className="break-words">
                                <span className="font-medium text-gray-600">{c.field}</span>: {c.from}{" "}
                                <span aria-label="changed to">→</span> {c.to}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-gray-500">
              Showing {first.toLocaleString()}–{(first + rows.length - 1).toLocaleString()} of {total.toLocaleString()}
            </p>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={href(params, page - 1)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Newer
                  </Link>
                )}
                <span className="text-gray-500">
                  Page {page} of {pages}
                </span>
                {page < pages && (
                  <Link
                    href={href(params, page + 1)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Older
                  </Link>
                )}
              </div>
            )}
          </nav>
        </>
      )}
    </>
  );
}
