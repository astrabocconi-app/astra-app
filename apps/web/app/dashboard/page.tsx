import Link from "next/link";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/app/_ui/page-header";
import { StatCard } from "@/app/_ui/card";
import { Badge } from "@/app/_ui/badge";
import {
  CoinsIcon,
  UsersIcon,
  CalendarIcon,
  GiftIcon,
  StoreIcon,
  BookIcon,
  ChevronRightIcon,
} from "@/app/_ui/icons";
import type { ReactNode } from "react";

const QUICK_LINKS: { href: string; label: string; desc: string; icon: ReactNode }[] = [
  { href: "/dashboard/users", label: "Users", desc: "Members & roles", icon: <UsersIcon size={22} /> },
  { href: "/dashboard/events", label: "Events", desc: "Sessions & check-in", icon: <CalendarIcon size={22} /> },
  { href: "/dashboard/points", label: "Points", desc: "Balances & rules", icon: <CoinsIcon size={22} /> },
  { href: "/dashboard/rewards", label: "Rewards", desc: "Catalog & redemptions", icon: <GiftIcon size={22} /> },
  { href: "/dashboard/partners", label: "Partners", desc: "Spots & perks", icon: <StoreIcon size={22} /> },
  { href: "/dashboard/materials", label: "Materials", desc: "Shared resources", icon: <BookIcon size={22} /> },
];

export default async function DashboardHome() {
  const session = await getSessionUser(await headers());
  const firstName = session?.user.name?.split(" ")[0];

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
          value="—"
          hint="Coming soon"
          icon={<CoinsIcon size={22} />}
        />
        <StatCard
          label="Active members"
          value="—"
          hint="Coming soon"
          icon={<UsersIcon size={22} />}
        />
        <StatCard
          label="Upcoming events"
          value="—"
          hint="Coming soon"
          icon={<CalendarIcon size={22} />}
        />
      </div>

      <div className="mt-8 mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Manage</h2>
        <Badge tone="neutral">Sections</Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-astra-light hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-astra-light text-astra-primary">
              {l.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-gray-900">{l.label}</span>
              <span className="block truncate text-sm text-gray-500">{l.desc}</span>
            </span>
            <span className="text-gray-300 transition-colors group-hover:text-astra-accent">
              <ChevronRightIcon size={20} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
