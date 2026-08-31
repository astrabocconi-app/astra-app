import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { StatCard } from "@/app/_ui/card";
import { Badge } from "@/app/_ui/badge";
import {
  CoinsIcon,
  UsersIcon,
  CalendarIcon,
  ChevronRightIcon,
} from "@/app/_ui/icons";
import { requirePage, visibleSections } from "@/lib/dashboard-access";
import { pageIcon } from "./_components/page-icons";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  // No layout.tsx of its own to guard this one: /dashboard's layout wraps every
  // section, so the check has to happen in the page.
  const session = await requirePage("overview");
  const firstName = session.user.name?.split(" ")[0];

  // The Manage cards mirror the sidebar rather than a hardcoded list, so a
  // staff account is never shown a section that would bounce it. Overview is
  // dropped: it is the page you are already on.
  const sections = visibleSections(session).filter((s) => s.key !== "overview");

  // Same "still upcoming" rule the app and the Events page use: keep same-day
  // events counted until the day is over.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [issued, members, upcomingEvents] = await Promise.all([
    // Only positive deltas — what's been handed out, not the net balance.
    prisma.pointsLedgerEntry.aggregate({ _sum: { delta: true }, where: { delta: { gt: 0 } } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.event.count({
      where: { deletedAt: null, published: true, startsAt: { gte: dayStart } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={firstName ? `Ciao, ${firstName}` : "Welcome to ASTRA"}
        subtitle="Your admin overview of the ASTRA loyalty platform."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          tone="brand"
          label="Points issued"
          value={(issued._sum.delta ?? 0).toLocaleString()}
          hint="All time, awards only"
          icon={<CoinsIcon size={22} />}
        />
        <StatCard
          label="Members"
          value={members.toLocaleString()}
          hint="Signed in at least once"
          icon={<UsersIcon size={22} />}
        />
        <StatCard
          label="Upcoming events"
          value={upcomingEvents.toLocaleString()}
          hint="Published & still to come"
          icon={<CalendarIcon size={22} />}
        />
      </div>

      {sections.map((section) => (
        <div key={section.key}>
          <div className="mt-8 mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{section.label}</h2>
            <Badge tone="neutral">{section.pages.length}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.pages.map((page) => (
              <Link
                key={page.key}
                href={page.href}
                className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-astra-light hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-astra-light text-astra-primary">
                  {pageIcon(page.key, 22)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">{page.label}</span>
                  <span className="block truncate text-sm text-gray-500">{page.blurb}</span>
                </span>
                <span className="text-gray-300 transition-colors group-hover:text-astra-accent">
                  <ChevronRightIcon size={20} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
