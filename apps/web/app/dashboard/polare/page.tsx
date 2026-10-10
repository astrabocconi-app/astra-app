import Link from "next/link";
import { prisma } from "@astra/db";
import { PageHeader } from "@/app/_ui/page-header";
import { ButtonLink } from "@/app/_ui/button";
import { Badge } from "@/app/_ui/badge";
import { EmptyState } from "@/app/_ui/empty-state";
import { StarIcon, PlusIcon, ChevronRightIcon } from "@/app/_ui/icons";
import { toPolarePost } from "@/lib/cms-map";
import { requireDashboardPage } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Stella Polare" };

const KIND_LABEL = { IMAGE: "Photo", CAROUSEL: "Carousel", REEL: "Reel" } as const;

export default async function PolareListPage() {
  await requireDashboardPage("polare");
  const rows = await prisma.polarePost.findMany({
    where: { deletedAt: null },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  const posts = rows.map((r) => toPolarePost(r));

  return (
    <>
      <PageHeader
        title="Stella Polare"
        subtitle="The feed students see in the Stella Polare section of the app."
        actions={
          <ButtonLink href="/dashboard/polare/new">
            <PlusIcon size={18} /> New post
          </ButtonLink>
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={<StarIcon size={28} />}
          title="No posts yet"
          description="Add the first photo, carousel or reel. It appears in the app as soon as it is published."
          action={
            <ButtonLink href="/dashboard/polare/new">
              <PlusIcon size={18} /> New post
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((p) => {
            const first = p.media[0];
            const thumb = first ? (first.type === "video" ? first.posterUrl : first.url) : null;
            return (
              <Link
                key={p.id}
                href={`/dashboard/polare/${p.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:border-astra-light hover:shadow-md"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-xs text-gray-500">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    KIND_LABEL[p.kind]
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{KIND_LABEL[p.kind]}</Badge>
                    {p.pinned && <Badge tone="brand">Shown first</Badge>}
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-700">{p.caption || "No caption"}</p>
                </div>
                <Badge tone={p.published ? "brand" : "neutral"}>{p.published ? "Published" : "Draft"}</Badge>
                <span className="text-gray-300 transition-colors group-hover:text-astra-accent">
                  <ChevronRightIcon size={20} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
