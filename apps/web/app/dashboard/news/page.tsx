import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { ButtonLink } from "@/app/_ui/button";
import { requireDashboardPage } from "../_lib/session";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { NewspaperIcon, PlusIcon, ChevronRightIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { title: "News" };

export default async function NewsListPage() {
  await requireDashboardPage("news");
  const rows = await prisma.newsPost.findMany({
    where: { deletedAt: null },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        title="News"
        subtitle="Announcements shown in the app feed."
        actions={
          <ButtonLink href="/dashboard/news/new">
            <PlusIcon size={18} /> New post
          </ButtonLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<NewspaperIcon size={28} />}
          title="No news yet"
          description="Publish your first announcement — it appears instantly in the app feed."
          action={
            <ButtonLink href="/dashboard/news/new">
              <PlusIcon size={18} /> New post
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((n) => (
            <Link
              key={n.id}
              href={`/dashboard/news/${n.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-astra-light hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-900">{n.title}</span>
                  {n.pinned && <Badge tone="brand">Shown first</Badge>}
                </div>
                {n.excerpt && <p className="mt-0.5 truncate text-sm text-gray-500">{n.excerpt}</p>}
              </div>
              <Badge tone={n.published ? "brand" : "neutral"}>{n.published ? "Published" : "Draft"}</Badge>
              <span className="text-gray-300 transition-colors group-hover:text-astra-accent">
                <ChevronRightIcon size={20} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
