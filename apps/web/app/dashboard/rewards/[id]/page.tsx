import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { toRewardItem } from "@/lib/cms-map";
import { RewardForm } from "../reward-form";

export const dynamic = "force-dynamic";

export default async function EditRewardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.reward.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound();

  return (
    <>
      <PageHeader title="Edit reward" subtitle="Update, hide, or delete this reward." />
      <RewardForm id={id} initial={toRewardItem(row)} />
    </>
  );
}
