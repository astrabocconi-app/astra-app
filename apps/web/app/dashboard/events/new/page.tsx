import { PageHeader } from "@/app/_ui/page-header";
import { EventForm } from "../event-form";
import { requireDashboardPage } from "../../_lib/session";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireDashboardPage("events");
  return (
    <>
      <PageHeader title="New event" subtitle="Advertise an event and link out for tickets." />
      <EventForm />
    </>
  );
}
