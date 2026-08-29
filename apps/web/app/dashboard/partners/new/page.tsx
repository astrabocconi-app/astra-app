import { PageHeader } from "@/app/_ui/page-header";
import { PartnerForm } from "../partner-form";

export default function NewPartnerPage() {
  return (
    <>
      <PageHeader
        title="New partner"
        subtitle="Add a venue and its discounts — it reaches the app immediately."
      />
      <PartnerForm />
    </>
  );
}
