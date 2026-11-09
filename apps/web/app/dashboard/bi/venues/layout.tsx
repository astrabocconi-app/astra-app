import { requireDashboardPage } from "../../_lib/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireDashboardPage("bi-venues");
  return <>{children}</>;
}
