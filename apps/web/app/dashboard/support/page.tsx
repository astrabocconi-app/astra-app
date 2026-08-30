import { prisma } from "@astra/db";
import Link from "next/link";
import { PageHeader } from "@/app/_ui/page-header";
import { EmptyState } from "@/app/_ui/empty-state";
import { AuditIcon } from "@/app/_ui/icons";
import { SupportRow } from "./support-row";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

const fmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const KIND_LABEL: Record<string, string> = {
  QUESTION: "Question",
  ISSUE: "Issue",
  IDEA: "Idea",
};

/**
 * Support inbox — what students send from the app's help screen.
 *
 * Every message carries the account that sent it, so the reply address is right
 * there rather than something the reporter had to type correctly.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  // Default to the open queue: the inbox is a to-do list, not an archive.
  const showResolved = status === "resolved";

  const rows = await prisma.supportMessage.findMany({
    where: { status: showResolved ? "RESOLVED" : "OPEN" },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: {
      user: {
        select: { id: true, email: true, name: true, deletedAt: true },
      },
    },
  });

  const openCount = await prisma.supportMessage.count({ where: { status: "OPEN" } });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Support"
        subtitle="Questions, issues and ideas sent from the app"
      />

      <div className="flex gap-2">
        <Link
          href="/dashboard/support"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            showResolved
              ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
              : "bg-astra-primary text-white"
          }`}
        >
          Open{openCount > 0 ? ` (${openCount})` : ""}
        </Link>
        <Link
          href="/dashboard/support?status=resolved"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            showResolved
              ? "bg-astra-primary text-white"
              : "border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Resolved
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<AuditIcon size={28} />}
          title={showResolved ? "Nothing resolved yet" : "Nothing to answer"}
          description={
            showResolved
              ? "Messages you mark as handled will appear here."
              : "Questions and ideas sent from the app will land here."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <SupportRow
              key={row.id}
              id={row.id}
              kind={row.kind}
              kindLabel={KIND_LABEL[row.kind] ?? row.kind}
              message={row.message}
              status={row.status}
              adminNote={row.adminNote}
              createdAt={fmt.format(row.createdAt)}
              platform={row.platform}
              appVersion={row.appVersion}
              sender={{
                name: row.user.name,
                // A deleted account keeps its thread but loses its address —
                // say so rather than showing the anonymised placeholder.
                email: row.user.deletedAt ? null : row.user.email,
              }}
            />
          ))}
        </div>
      )}

      {rows.length === PAGE_SIZE && (
        <p className="text-xs text-gray-400">
          Showing the {PAGE_SIZE} most recent. Resolve some to clear the queue.
        </p>
      )}
    </div>
  );
}
