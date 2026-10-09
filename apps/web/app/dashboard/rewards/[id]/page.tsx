import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Card } from "@/app/_ui/card";
import { romeDateTime } from "@/app/_ui/rome";
import { requireDashboardPage } from "../../_lib/session";
import { Badge } from "@/app/_ui/badge";
import { toRewardItem } from "@/lib/cms-map";
import { RewardForm } from "../reward-form";
import { CodePool } from "../code-pool";
import { codeCounts } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit reward" };

export default async function EditRewardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDashboardPage("rewards");
  const { id } = await params;
  const row = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound();
  const pool = await codeCounts(id);
  const pendingRedemptions = await prisma.rewardRedemption.count({ where: { rewardId: id, status: "PENDING" } });
  const redemptions = await prisma.rewardRedemption.findMany({
    where: { rewardId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <>
      <PageHeader title="Edit reward" subtitle="Update, hide, or delete this reward." />
      <div className="flex flex-col gap-5">
        <RewardForm
          id={id}
          initial={toRewardItem(row)}
          unusedCodes={pool.available}
          pendingRedemptions={pendingRedemptions}
        />
        <CodePool rewardId={id} total={pool.total} available={pool.available} />

        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Recent redemptions</h2>
            <p className="text-xs text-gray-500">
              Who claimed this reward. Points are already deducted; a redemption without a code
              needs fulfilling by hand.
            </p>
          </div>
          {redemptions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
              Nobody has redeemed this yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Student</th>
                  <th className="py-2 font-medium">When (Milan)</th>
                  <th className="py-2 font-medium">Code</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {redemptions.map((r) => (
                  <tr key={r.id}>
                    <td className="break-all py-2 text-gray-800">{r.user.name ?? r.user.email}</td>
                    <td className="whitespace-nowrap py-2 text-gray-500">
                      {romeDateTime(r.createdAt)}
                    </td>
                    <td className="py-2 font-mono text-xs text-gray-700">{r.code ?? "—"}</td>
                    <td className="py-2">
                      <Badge tone={r.status === "FULFILLED" ? "brand" : "neutral"}>
                        {r.status === "FULFILLED" ? "Fulfilled" : "Pending"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
