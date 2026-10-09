import { PageHeader } from "@/app/_ui/page-header";
import { RewardForm } from "../reward-form";
import { requireDashboardPage } from "../../_lib/session";

export const metadata = { title: "New reward" };

export default async function NewRewardPage() {
  await requireDashboardPage("rewards");
  return (
    <>
      <PageHeader title="New reward" subtitle="Add something students can redeem with points." />
      <RewardForm />
    </>
  );
}
