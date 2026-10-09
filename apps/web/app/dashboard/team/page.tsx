import { headers } from "next/headers";
import { PageHeader } from "@/app/_ui/page-header";
import { requireDashboardPage } from "../_lib/session";
import { listStaffAccounts } from "@/lib/staff-accounts";
import { TeamManager, type StaffRow } from "./team-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  await requireDashboardPage("team");
  const host = (await headers()).get("host");
  const signInUrl = `${host ? `https://${host}` : ""}/signin`;
  const accounts = await listStaffAccounts();

  // Dates are serialised here: a Date cannot cross into a client component.
  const rows: StaffRow[] = accounts.map((a) => ({
    id: a.id,
    username: a.username,
    name: a.name,
    pages: a.pages,
    createdAt: a.createdAt.toISOString(),
    lastSignInAt: a.lastSignInAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team"
        subtitle={`Backoffice accounts and the pages each one can open. They sign in at ${signInUrl} with their username.`}
      />
      <TeamManager accounts={rows} />
    </div>
  );
}
