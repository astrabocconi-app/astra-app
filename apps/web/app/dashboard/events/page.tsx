import { SectionPlaceholder } from "../_components/placeholder";
import { CalendarIcon } from "@/app/_ui/icons";

export default function EventsPage() {
  return (
    <SectionPlaceholder
      title="Events"
      subtitle="Sessions, RSVPs, and check-in."
      icon={<CalendarIcon size={30} />}
      description="Create events, track RSVPs, and check members in with QR codes to award points."
    />
  );
}
