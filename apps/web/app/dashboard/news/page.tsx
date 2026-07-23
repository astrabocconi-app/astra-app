import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { Button } from "@/app/_ui/button";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { NewspaperIcon, PlusIcon, ChevronRightIcon } from "@/app/_ui/icons";

export const dynamic = "force-dynamic";

export default async function NewsListPage() {
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
          <Link href="/dashboard/news/new">
            <Button>
              <PlusIcon size={18} /> New post
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<NewspaperIcon size={28} />}
          title="No news yet"
          description="Publish your first announcement — it appears instantly in the app feed."
          action={
            <Link href="/dashboard/news/new">
              <Button>
                <PlusIcon size={18} /> New post
              </Button>
            </Link>
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
                  {n.pinned && <Badge tone="brand">Pinned</Badge>}
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
