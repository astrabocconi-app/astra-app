import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Button } from "@/app/_ui/button";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { CalendarIcon, PlusIcon, ChevronRightIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function EventsListPage() {
  const rows = await prisma.event.findMany({
    where: { deletedAt: null },
    orderBy: { startsAt: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Advertised in the app; students tap through to buy tickets."
        actions={
          <Link href="/dashboard/events/new">
            <Button>
              <PlusIcon size={18} /> New event
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={28} />}
          title="No events yet"
          description="Create an event with a ticket link — it shows up in the app's Events tab."
          action={
            <Link href="/dashboard/events/new">
              <Button>
                <PlusIcon size={18} /> New event
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/events/${e.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-astra-light hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <span className="truncate font-medium text-gray-900">{e.title}</span>
                <p className="mt-0.5 truncate text-sm text-gray-500">
                  {fmt.format(e.startsAt)}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </div>
              <Badge tone={e.published ? "brand" : "neutral"}>{e.published ? "Published" : "Draft"}</Badge>
              <span className="text-gray-300 transition-colors group-hover:text-astra-accent">
                <ChevronRightIcon size={20} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
