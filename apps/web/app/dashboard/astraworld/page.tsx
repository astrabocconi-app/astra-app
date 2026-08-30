import { PageHeader } from "@/app/_ui/page-header";
import { AstraWorldEditor } from "./astraworld-editor";

export const dynamic = "force-dynamic";

export default function AstraWorldPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AstraWorld"
        subtitle="Edit the event page in the app. Changes appear without an App Store update."
      />
      <AstraWorldEditor />
    </div>
  );
}
