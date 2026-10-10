import { PageHeader } from "@/app/_ui/page-header";
import { PolareForm } from "../polare-form";
import { requireDashboardPage } from "../../_lib/session";

export const metadata = { title: "New Stella Polare post" };

export default async function NewPolarePage() {
  await requireDashboardPage("polare");
  return (
    <>
      <PageHeader title="New post" subtitle="Add a photo, carousel or reel to the Stella Polare feed." />
      <PolareForm />
    </>
  );
}
