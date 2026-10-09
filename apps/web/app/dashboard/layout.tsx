import type { Metadata } from "next";
import Link from "next/link";
import { AstraLogo } from "@/app/_ui/logo";
import { Badge } from "@/app/_ui/badge";
import { SidebarNav } from "./_components/sidebar-nav";
import { SignOutButton } from "./_components/sign-out-button";
import { DashboardShell } from "./_components/shell";
import { getSessionUserCached } from "./_lib/session";
import { visibleSections } from "@/lib/dashboard-access";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

// Never indexed, and every page below sets its own name ("Events · ASTRA Dashboard").
export const metadata: Metadata = {
  title: { template: "%s · ASTRA Dashboard", default: "ASTRA Dashboard" },
  robots: { index: false, follow: false },
};

// Roles allowed into the dashboard at all. Per-action authorization still runs
// through lib/authz.ts inside each route/page.
const STAFF_ROLES = ["ADMIN", "AREA_MANAGER", "STAFF"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUserCached();

  // Not signed in → go to the sign-in page.
  if (!session) redirect("/signin");

  // Signed in but not staff → deny (deny-by-default).
  const isStaff = session.user.roles.some((r) => STAFF_ROLES.includes(r));
  if (!isStaff) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <AstraLogo size={48} className="text-astra-primary" />
        <h1 className="text-xl font-semibold text-gray-900">No dashboard access</h1>
        <p className="break-words text-gray-500">
          Signed in as {session.user.email}, but this account has no staff role.
          Ask an admin to grant access.
        </p>
        <SignOutButton />
      </main>
    );
  }

  const email = session.user.email;
  const who = session.user.staffUsername ?? email;
  const initial = (session.user.name ?? who).charAt(0).toUpperCase();
  const admin = isAdmin(session.actor);
  const sections = visibleSections(session);

  // A staff account with nothing ticked would otherwise land on a blank shell
  // with an empty sidebar and no way to tell whether it is broken or just empty.
  if (sections.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <AstraLogo size={48} className="text-astra-primary" />
        <h1 className="text-xl font-semibold text-gray-900">Nothing assigned yet</h1>
        <p className="break-words text-gray-500">
          Signed in as {who}. This account has no pages assigned. Ask an admin to
          grant access from Administration &rsaquo; Team.
        </p>
        <SignOutButton />
      </main>
    );
  }

  const sidebar = (
    <>
      <Link
        href="/dashboard"
        className="mb-8 flex items-center gap-2.5 px-2 text-astra-primary"
      >
        <AstraLogo size={30} />
        <span className="text-lg font-bold tracking-tight">ASTRA</span>
        <Badge tone="neutral">{admin ? "Admin" : "Staff"}</Badge>
      </Link>

      {/* Sections make the list taller than a flat one, so it scrolls rather
          than pushing the account block off the bottom on short screens. */}
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        <SidebarNav sections={sections} />
      </div>

      <div className="mt-auto border-t border-gray-100 pt-4">
        <div className="mb-3 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-astra-light text-sm font-semibold text-astra-primary">
            {initial}
          </div>
          {/* A staff account's email is synthetic — derived from the
              username and never used — so showing it would be noise. */}
          <p className="truncate text-xs text-gray-500" title={who}>
            {who}
          </p>
        </div>
        <SignOutButton />
      </div>
    </>
  );

  return <DashboardShell sidebar={sidebar}>{children}</DashboardShell>;
}
