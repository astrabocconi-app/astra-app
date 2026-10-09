import { PageHeader } from "@/app/_ui/page-header";
import { PartnerForm } from "../partner-form";
import { requireDashboardPage } from "../../_lib/session";

export const metadata = { title: "New partner" };

export default async function NewPartnerPage() {
  await requireDashboardPage("partners");
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
