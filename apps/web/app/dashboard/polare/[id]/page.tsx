import { notFound } from "next/navigation";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { toPolarePost } from "@/lib/cms-map";
import { PolareForm } from "../polare-form";
import { requireDashboardPage } from "../../_lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit Stella Polare post" };

export default async function EditPolarePage({ params }: { params: Promise<{ id: string }> }) {
  await requireDashboardPage("polare");
  const { id } = await params;
  const row = await prisma.polarePost.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound();

  return (
    <>
      <PageHeader title="Edit post" subtitle="Update, pin or unpublish this post." />
      <PolareForm id={id} initial={toPolarePost(row)} />
    </>
  );
}
