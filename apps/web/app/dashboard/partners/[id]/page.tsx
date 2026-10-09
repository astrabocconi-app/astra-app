import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { toPartnerItem } from "@/lib/cms-map";
import { PartnerForm } from "../partner-form";
import { requireDashboardPage } from "../../_lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit partner" };

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDashboardPage("partners");
  const { id } = await params;
  const row = await prisma.partner.findFirst({
    where: { id, deletedAt: null },
    include: { offers: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
  });
  if (!row) notFound();

  return (
    <>
      <PageHeader title="Edit partner" subtitle="Update the venue, its location, or its discounts." />
      <PartnerForm id={id} initial={toPartnerItem(row)} />
    </>
  );
}
