import { requirePage } from "@/lib/dashboard-access";

// Guards this section and everything nested under it. See lib/dashboard-access.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePage("team");
  return <>{children}</>;
}
