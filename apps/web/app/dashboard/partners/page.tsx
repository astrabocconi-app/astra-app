import { SectionPlaceholder } from "../_components/placeholder";
import { StoreIcon } from "@/app/_ui/icons";

export default function PartnersPage() {
  return (
    <SectionPlaceholder
      title="Partners"
      subtitle="Spots, perks, and point-earning venues."
      icon={<StoreIcon size={30} />}
      description="Onboard partner venues, manage their perks, and see where members earn points."
    />
  );
}
