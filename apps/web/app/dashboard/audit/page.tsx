import { SectionPlaceholder } from "../_components/placeholder";
import { AuditIcon } from "@/app/_ui/icons";

export default function AuditPage() {
  return (
    <SectionPlaceholder
      title="Audit log"
      subtitle="A record of staff actions."
      icon={<AuditIcon size={30} />}
      description="Review a chronological log of sensitive staff actions across the platform."
    />
  );
}
