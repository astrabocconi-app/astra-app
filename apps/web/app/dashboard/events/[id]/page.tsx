import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { toEventItem } from "@/lib/cms-map";
import { EventForm } from "../event-form";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.event.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound();

  return (
    <>
      <PageHeader title="Edit event" subtitle="Update or unpublish this event." />
      <EventForm id={id} initial={toEventItem(row)} />
    </>
  );
}
