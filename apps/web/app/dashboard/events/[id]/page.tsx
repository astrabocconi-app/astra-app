import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { toEventItem } from "@/lib/cms-map";
import { EventForm } from "../event-form";
import { issuedCounts } from "@/lib/event-discount";
import { requireDashboardPage } from "../../_lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDashboardPage("events");
  const { id } = await params;
  const row = await prisma.event.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound();

  return (
    <>
      <PageHeader title="Edit event" subtitle="Update or unpublish this event." />
      <EventForm id={id} initial={toEventItem(row)} issued={(await issuedCounts([id])).get(id) ?? 0} />
    </>
  );
}
