import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { AuditIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const fmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Past-tense phrasing so a row reads as a sentence: "<actor> published Event".
const ACTION_VERB: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  publish: "published",
  unpublish: "unpublished",
};

function summarise(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  // Most writers record a human-readable name under one of these.
  for (const key of ["title", "name", "reason"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

export default async function AuditLogPage() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`Who changed what. Append-only — entries are never edited or removed. Showing the latest ${PAGE_SIZE}.`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<AuditIcon size={28} />}
          title="Nothing logged yet"
          description="Every create, edit, publish and delete made from this dashboard will be recorded here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
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
                const who = r.actor?.name ?? r.actor?.email ?? "Unknown";
                const detail = summarise(r.metadata);
                return (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {fmt.format(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{who}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.action === "delete" ? "neutral" : "brand"}>
                        {ACTION_VERB[r.action] ?? r.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-medium">{r.targetType ?? "—"}</span>
                      {detail && <span className="text-gray-500"> · {detail}</span>}
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
