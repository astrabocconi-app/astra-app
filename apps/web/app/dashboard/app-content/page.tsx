import { prisma } from "@astra/db";
import { homeBubbleContent, mapSponsorsContent } from "@astra/shared";
import { PageHeader } from "@/app/_ui/page-header";
import { requireDashboardPage } from "../_lib/session";
import { HomeBubbleForm, MapSponsorsForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "App overlays" };

export default async function AppContentPage() {
  await requireDashboardPage("app-content");
  const rows = await prisma.appContent.findMany({ where: { key: { in: ["home-bubble", "map-sponsors"] } } });
  const raw = (key: string) => rows.find((r) => r.key === key)?.data ?? {};
  // A row that no longer fits the schema opens as the defaults rather than crashing the page.
  const home = homeBubbleContent.safeParse(raw("home-bubble"));
  const map = mapSponsorsContent.safeParse(raw("map-sponsors"));

  return (
    <>
      <PageHeader
        title="App overlays"
        subtitle="Live in the app within a minute of saving, no app update needed."
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <MapSponsorsForm initial={map.success ? map.data : mapSponsorsContent.parse({})} />
        <HomeBubbleForm initial={home.success ? home.data : homeBubbleContent.parse({})} />
      </div>
    </>
  );
}
