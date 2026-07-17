import { SectionPlaceholder } from "../_components/placeholder";
import { CoinsIcon } from "@/app/_ui/icons";

export default function PointsPage() {
  return (
    <SectionPlaceholder
      title="Points"
      subtitle="Balances, earning rules, and adjustments."
      icon={<CoinsIcon size={30} />}
      description="Configure how members earn points, review balances, and make manual adjustments."
    />
  );
}
