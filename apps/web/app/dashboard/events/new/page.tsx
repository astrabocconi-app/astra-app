import { PageHeader } from "@/app/_ui/page-header";
import { EventForm } from "../event-form";

export default function NewEventPage() {
  return (
    <>
      <PageHeader title="New event" subtitle="Advertise an event and link out for tickets." />
      <EventForm />
    </>
  );
}
