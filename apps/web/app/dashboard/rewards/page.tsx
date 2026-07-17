import { SectionPlaceholder } from "../_components/placeholder";
import { GiftIcon } from "@/app/_ui/icons";

export default function RewardsPage() {
  return (
    <SectionPlaceholder
      title="Rewards"
      subtitle="Catalog and redemptions."
      icon={<GiftIcon size={30} />}
      description="Manage the rewards catalog and partner perks members can unlock with their points."
    />
  );
}
