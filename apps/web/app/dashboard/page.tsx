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
import { visibleSections } from "@/lib/dashboard-access";
import { isAdmin } from "@/lib/authz";
import { romeDayStart } from "@/app/_ui/rome";
import { requireDashboardPage } from "./_lib/session";
import { pageIcon } from "./_components/page-icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

// Points that were really handed out to students: scans, check-ins and the signup
// bonus, for accounts that still exist. Manual adjustments and refunds are not awards.
const AWARD_SOURCES = ["SIGNUP", "PARTNER_SCAN", "EVENT_CHECKIN"] as const;
const LIVE_STUDENT = { deletedAt: null, roles: { has: "STUDENT" as const } };

export default async function DashboardHome() {
  // No layout.tsx of its own to guard this one: /dashboard's layout wraps every
  // section, so the check has to happen in the page.
  const session = await requireDashboardPage("overview");
  // The env-admin account is literally named "ASTRA": "Ciao, ASTRA" reads like a bug.
  const firstName = session.user.name?.split(" ")[0];
  const greetName = firstName && firstName.toLowerCase() !== "astra" ? firstName : undefined;

  // The Manage cards mirror the sidebar rather than a hardcoded list, so a
  // staff account is never shown a section that would bounce it. Overview is
  // dropped: it is the page you are already on.
  const sections = visibleSections(session).filter((s) => s.key !== "overview");

  // Same "still upcoming" rule the app and the Events page use: keep same-day
  // events counted until the day is over.
  const dayStart = romeDayStart(); // midnight in Milan, whatever the server clock says

  const [issued, members, upcomingEvents] = await Promise.all([
    // Only positive deltas — what's been handed out, not the net balance.
    prisma.pointsLedgerEntry.aggregate({
      _sum: { delta: true },
      where: { delta: { gt: 0 }, source: { in: [...AWARD_SOURCES] }, user: LIVE_STUDENT },
    }),
    prisma.user.count({ where: LIVE_STUDENT }),
    prisma.event.count({
      where: { deletedAt: null, published: true, startsAt: { gte: dayStart } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={greetName ? `Ciao, ${greetName}` : "Welcome to ASTRA"}
        subtitle={
          isAdmin(session.actor)
            ? "Your admin overview of the ASTRA platform."
            : "Your overview of the ASTRA platform. The sections below are the ones you can open."
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          tone="brand"
          label="Points issued"
          value={(issued._sum.delta ?? 0).toLocaleString()}
          hint="All time: scans, check-ins and signup bonuses"
          icon={<CoinsIcon size={22} />}
        />
        <StatCard
          label="Students"
          value={members.toLocaleString()}
          hint="Signed in to the app at least once"
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
