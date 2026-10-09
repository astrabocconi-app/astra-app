import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { toNewsItem } from "@/lib/cms-map";
import { NewsForm } from "../news-form";
import { canAccessPage } from "@/lib/dashboard-access";
import { requireDashboardPage } from "../../_lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit post" };

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardPage("news");
  const { id } = await params;
  const row = await prisma.newsPost.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound();

  return (
    <>
      <PageHeader title="Edit post" subtitle="Update or unpublish this announcement." />
      <NewsForm id={id} initial={toNewsItem(row)} canPush={canAccessPage(session, "push")} />
    </>
  );
}
