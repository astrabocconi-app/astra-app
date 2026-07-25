import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { toNewsItem } from "@/lib/cms-map";
import { NewsForm } from "../news-form";

export const dynamic = "force-dynamic";

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.newsPost.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound();

  return (
    <>
      <PageHeader title="Edit post" subtitle="Update or unpublish this announcement." />
      <NewsForm id={id} initial={toNewsItem(row)} />
    </>
  );
}
