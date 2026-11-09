import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Card, StatCard } from "@/app/_ui/card";
import { romeDayKey } from "@/app/_ui/rome";
import { offerLabel } from "@/lib/cms-map";
import { requireDashboardPage } from "../../_lib/session";
import { RefreshButton } from "../../users/refresh-button";
import { LineChart } from "../charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venues & discounts" };

// Two sources, because most venues have no QR redemption:
//   - QR scans: points-ledger rows a venue's scanner wrote (PARTNER_SCAN), per
//     student, so they give real usage, unique students and repeat visits;
//   - interactions: anonymous counts of venue page opens, offer-link taps and
//     directions taps from the app (VenueInteraction), the interest signal.

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
] as const;

type SortKey = "scans" | "students" | "views" | "links";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "scans", label: "QR uses" },
  { key: "students", label: "Students" },
  { key: "views", label: "Page views" },
  { key: "links", label: "Link taps" },
];

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-astra-primary" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

function Num({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

export default async function VenuesBiPage({ searchParams }: { searchParams: Promise<{ days?: string; sort?: string }> }) {
  await requireDashboardPage("bi-venues");
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p.days) === sp.days)?.days ?? 30;
  const sort: SortKey = SORTS.find((x) => x.key === sp.sort)?.key ?? "scans";
  const since = days ? new Date(Date.now() - days * 86_400_000) : undefined;
  const createdAt = since ? { gte: since } : undefined;

  const [partners, scans, interactions] = await Promise.all([
    prisma.partner.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        category: true,
        active: true,
        offers: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pointsLedgerEntry.findMany({
      where: { source: "PARTNER_SCAN", refType: "Partner", createdAt },
      select: { refId: true, offerId: true, userId: true, createdAt: true },
      take: 200_000,
    }),
    prisma.venueInteraction.groupBy({
      by: ["partnerId", "offerId", "kind"],
      where: { createdAt },
      _count: { _all: true },
    }),
  ]);

  type Row = {
    id: string;
    name: string;
    category: string | null;
    active: boolean;
    scans: number;
    students: number;
    repeat: number;
    views: number;
    links: number;
    directions: number;
    offers: { id: string; title: string; label: string; scans: number; links: number; hasLink: boolean; qr: boolean }[];
  };

  const byVenue = new Map<string, { scans: number; perUser: Map<string, number>; perOffer: Map<string, number> }>();
  for (const s of scans) {
    if (!s.refId) continue;
    const v = byVenue.get(s.refId) ?? { scans: 0, perUser: new Map(), perOffer: new Map() };
    v.scans++;
    v.perUser.set(s.userId, (v.perUser.get(s.userId) ?? 0) + 1);
    if (s.offerId) v.perOffer.set(s.offerId, (v.perOffer.get(s.offerId) ?? 0) + 1);
    byVenue.set(s.refId, v);
  }
  const counts = new Map<string, number>();
  for (const g of interactions) {
    const n = g._count._all;
    counts.set(`${g.partnerId}|${g.kind}`, (counts.get(`${g.partnerId}|${g.kind}`) ?? 0) + n);
    if (g.offerId && g.kind === "LINK") counts.set(`offer|${g.offerId}`, (counts.get(`offer|${g.offerId}`) ?? 0) + n);
  }

  const rows: Row[] = partners.map((p) => {
    const v = byVenue.get(p.id);
    const perUser = [...(v?.perUser.values() ?? [])];
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      active: p.active,
      scans: v?.scans ?? 0,
      students: perUser.length,
      repeat: perUser.filter((n) => n > 1).length,
      views: counts.get(`${p.id}|VIEW`) ?? 0,
      links: counts.get(`${p.id}|LINK`) ?? 0,
      directions: counts.get(`${p.id}|DIRECTIONS`) ?? 0,
      offers: p.offers.map((o) => ({
        id: o.id,
        title: o.title,
        label: offerLabel(o),
        scans: v?.perOffer.get(o.id) ?? 0,
        links: counts.get(`offer|${o.id}`) ?? 0,
        hasLink: Boolean(o.linkUrl),
        qr: o.qrEnabled,
      })),
    };
  });
  rows.sort((a, b) => b[sort] - a[sort] || b.views - a.views || a.name.localeCompare(b.name));

  const totalScans = scans.length;
  const totalStudents = new Set(scans.map((s) => s.userId)).size;
  const totalViews = rows.reduce((n, r) => n + r.views, 0);
  const totalLinks = rows.reduce((n, r) => n + r.links, 0);
  const max = Math.max(1, ...rows.map((r) => r[sort]));

  // QR uses per day, Milan time.
  const span = days || 90;
  const perDay = new Map<string, number>();
  for (const s of scans) perDay.set(romeDayKey(s.createdAt), (perDay.get(romeDayKey(s.createdAt)) ?? 0) + 1);
  const series: { label: string; value: number }[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const k = romeDayKey(new Date(Date.now() - i * 86_400_000));
    series.push({ label: k.slice(5), value: perDay.get(k) ?? 0 });
  }

  const href = (p: { days?: number; sort?: SortKey }) =>
    `/dashboard/bi/venues?days=${p.days ?? days}&sort=${p.sort ?? sort}`;
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${on ? "bg-astra-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;

  return (
    <>
      <PageHeader
        title="Venues & discounts"
        subtitle="Which partners students actually use (QR scans) and look at (page views, link and directions taps)."
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <Link key={p.days} href={href({ days: p.days })} className={pill(p.days === days)}>
              {p.label}
            </Link>
          ))}
          <span className="ml-auto">
            <RefreshButton />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Rank by</span>
          {SORTS.map((x) => (
            <Link key={x.key} href={href({ sort: x.key })} className={pill(x.key === sort)}>
              {x.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="QR uses" value={totalScans.toLocaleString()} hint="Discounts scanned at venues" tone="brand" />
        <StatCard label="Students" value={totalStudents.toLocaleString()} hint="Used at least one QR discount" />
        <StatCard label="Venue page views" value={totalViews.toLocaleString()} />
        <StatCard label="Offer link taps" value={totalLinks.toLocaleString()} hint="e.g. Stripe checkouts" />
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">QR uses per day ({days ? `last ${days} days` : "last 90 days"}, Milan time)</h2>
        <LineChart points={series} />
      </Card>

      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <Card key={r.id} className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/partners/${r.id}`} className="text-base font-semibold text-gray-900 hover:text-astra-primary">
                  {r.name}
                </Link>
                <p className="text-xs text-gray-500">
                  {[r.category, r.active ? null : "Hidden from the app"].filter(Boolean).join(" · ") || "No category"}
                </p>
                <div className="mt-2">
                  <Bar value={r[sort]} max={max} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <Num label="QR uses" value={r.scans} />
              <Num label="Students" value={r.students} />
              <Num label="Came back" value={r.students ? `${Math.round((r.repeat / r.students) * 100)}%` : "–"} />
              <Num label="Page views" value={r.views} />
              <Num label="Link taps" value={r.links} />
              <Num label="Directions" value={r.directions} />
            </div>

            {r.offers.length > 0 && (
              <details className="group rounded-xl bg-gray-50 px-3 py-2">
                <summary className="cursor-pointer list-none text-xs font-medium text-gray-600">
                  {r.offers.length} discount{r.offers.length === 1 ? "" : "s"} <span className="text-gray-400 group-open:hidden">· show</span>
                </summary>
                <ul className="mt-2 flex flex-col divide-y divide-gray-100">
                  {r.offers.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                      <span className="min-w-0 flex-1 text-gray-800">{o.title}</span>
                      <span className="text-xs tabular-nums text-gray-500">
                        {o.qr ? `${o.scans.toLocaleString()} QR` : "No QR"}
                        {o.hasLink ? ` · ${o.links.toLocaleString()} link taps` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        “Came back” is the share of students who used a QR discount here more than once in the period. Page views, link
        and directions taps are counted from app version 1.2 on and are anonymous: they tell you interest, not who.
        A scan made without choosing a specific discount counts for the venue but not for any one discount.
      </p>
    </>
  );
}
