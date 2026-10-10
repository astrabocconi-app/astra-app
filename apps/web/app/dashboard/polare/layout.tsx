import { requireDashboardPage } from "../_lib/session";

// Guards this section and everything nested under it (the cached session is shared
// with the page, which re-checks on its own: layouts are skipped on partial renders).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireDashboardPage("polare");
  return <>{children}</>;
}
