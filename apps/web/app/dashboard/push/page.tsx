import { PageHeader } from "@/app/_ui/page-header";
import { PushComposer } from "./push-composer";

export const dynamic = "force-dynamic";

export default function PushPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications"
        subtitle="Send a push notification to students, with filters to narrow who gets it"
      />
      <PushComposer />
    </div>
  );
}
