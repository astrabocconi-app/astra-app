import { PageHeader } from "@/app/_ui/page-header";
import { RewardForm } from "../reward-form";

export default function NewRewardPage() {
  return (
    <>
      <PageHeader title="New reward" subtitle="Add something students can redeem with points." />
      <RewardForm />
    </>
  );
}
