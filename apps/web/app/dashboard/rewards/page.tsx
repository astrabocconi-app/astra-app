import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Button } from "@/app/_ui/button";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { GiftIcon, PlusIcon, ChevronRightIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

export default async function RewardsListPage() {
  const rows = await prisma.reward.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Rewards"
        subtitle="The catalog students spend their points on."
        actions={
          <Link href="/dashboard/rewards/new">
            <Button>
              <PlusIcon size={18} /> New reward
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<GiftIcon size={28} />}
          title="No rewards yet"
          description="Add a reward with a point cost — active rewards appear in the app catalog."
          action={
            <Link href="/dashboard/rewards/new">
              <Button>
                <PlusIcon size={18} /> New reward
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/rewards/${r.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-astra-light hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <span className="truncate font-medium text-gray-900">{r.title}</span>
                <p className="mt-0.5 text-sm text-gray-500">
                  {r.costPoints.toLocaleString()} pts · {r.stock === null ? "Unlimited" : `${r.stock} in stock`}
                </p>
              </div>
              <Badge tone={r.active ? "brand" : "neutral"}>{r.active ? "Active" : "Hidden"}</Badge>
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
