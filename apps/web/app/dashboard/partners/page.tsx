import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Button } from "@/app/_ui/button";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { StoreIcon, PlusIcon, ChevronRightIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

export default async function PartnersListPage() {
  const rows = await prisma.partner.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      offers: { where: { deletedAt: null, active: true }, select: { id: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Venues and their discounts — students see these on the Discounts map."
        actions={
          <Link href="/dashboard/partners/new">
            <Button>
              <PlusIcon size={18} /> New partner
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<StoreIcon size={28} />}
          title="No partners yet"
          description="Add a venue with its address and discount — it appears in the app straight away, no app update needed."
          action={
            <Link href="/dashboard/partners/new">
              <Button>
                <PlusIcon size={18} /> New partner
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((p) => {
            const located = p.latitude != null && p.longitude != null;
            return (
              <Link
                key={p.id}
                href={`/dashboard/partners/${p.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-astra-light hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <span className="truncate font-medium text-gray-900">{p.name}</span>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {p.category ?? "Uncategorised"} ·{" "}
                    {p.offers.length === 1 ? "1 discount" : `${p.offers.length} discounts`}
                    {p.address ? ` · ${p.address}` : ""}
                  </p>
                </div>
                {!located && <Badge tone="neutral">No pin</Badge>}
                <Badge tone={p.active ? "brand" : "neutral"}>{p.active ? "Active" : "Hidden"}</Badge>
                <span className="text-gray-300 transition-colors group-hover:text-astra-accent">
                  <ChevronRightIcon size={20} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
