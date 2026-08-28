import Link from "next/link";
import { prisma } from "@astra/db";
import type { Event as EventRow } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Button } from "@/app/_ui/button";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { CalendarIcon, PlusIcon, ChevronRightIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function EventRowLink({ e, past }: { e: EventRow; past?: boolean }) {
  return (
    <Link
      href={`/dashboard/events/${e.id}`}
      className={`group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-astra-light hover:shadow-md ${
        past ? "opacity-70 hover:opacity-100" : ""
      }`}
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
  );
}

export default async function EventsListPage() {
  const rows = await prisma.event.findMany({
    where: { deletedAt: null },
    orderBy: { startsAt: "asc" },
  });

  // An event counts as past once its end time has gone by — or, when it has no
  // end time, once its start day is over. This mirrors /api/events, which keeps
  // same-day events visible to students all day rather than hiding them the
  // minute they begin.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const now = new Date();
  const isPast = (e: EventRow) => (e.endsAt ? e.endsAt < now : e.startsAt < dayStart);

  const past = rows.filter(isPast).reverse(); // most recently finished first
  const upcoming = rows.filter((e) => !isPast(e));

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
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Upcoming</h2>
              <span className="text-xs text-gray-400">
                {upcoming.length === 1 ? "1 event" : `${upcoming.length} events`}
              </span>
            </div>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                Nothing coming up. New events appear here and in the app straight away.
              </p>
            ) : (
              upcoming.map((e) => <EventRowLink key={e.id} e={e} />)
            )}
          </section>

          {past.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Past events</h2>
                <span className="text-xs text-gray-400">
                  {past.length === 1 ? "1 event" : `${past.length} events`}
                </span>
              </div>
              <p className="-mt-1 mb-1 text-xs text-gray-400">
                Already finished, so students no longer see these. Still editable and reusable.
              </p>
              {past.map((e) => (
                <EventRowLink key={e.id} e={e} past />
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
