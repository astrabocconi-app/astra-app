import { PageHeader } from "@/app/_ui/page-header";
import { PushComposer } from "./push-composer";
import { requireDashboardPage } from "../_lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function PushPage() {
  await requireDashboardPage("push");
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
