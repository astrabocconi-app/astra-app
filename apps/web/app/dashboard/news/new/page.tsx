import { PageHeader } from "@/app/_ui/page-header";
import { NewsForm } from "../news-form";
import { canAccessPage } from "@/lib/dashboard-access";
import { requireDashboardPage } from "../../_lib/session";

export const metadata = { title: "New post" };

export default async function NewNewsPage() {
  const session = await requireDashboardPage("news");
  return (
    <>
      <PageHeader title="New post" subtitle="Write an announcement for the app feed." />
      <NewsForm canPush={canAccessPage(session, "push")} />
    </>
  );
}
