import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { AstraLogo } from "@/app/_ui/logo";
import { Badge } from "@/app/_ui/badge";
import { SidebarNav } from "./_components/sidebar-nav";
import { SignOutButton } from "./_components/sign-out-button";

// Roles allowed into the dashboard at all. Per-action authorization still runs
// through lib/authz.ts inside each route/page.
const STAFF_ROLES = ["ADMIN", "AREA_MANAGER", "STAFF"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser(await headers());

  // Not signed in → go to the sign-in page.
  if (!session) redirect("/signin");

  // Signed in but not staff → deny (deny-by-default).
  const isStaff = session.user.roles.some((r) => STAFF_ROLES.includes(r));
  if (!isStaff) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <AstraLogo size={48} className="text-astra-primary" />
        <h1 className="text-xl font-semibold text-gray-900">No dashboard access</h1>
        <p className="text-gray-500">
          Signed in as {session.user.email}, but this account has no staff role.
          Ask an admin to grant access.
        </p>
        <SignOutButton />
      </main>
    );
  }

  const email = session.user.email;
  const initial = (session.user.name ?? email).charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-gray-100 bg-white/80 px-4 py-5 backdrop-blur">
        <Link
          href="/dashboard"
          className="mb-8 flex items-center gap-2.5 px-2 text-astra-primary"
        >
          <AstraLogo size={30} />
          <span className="text-lg font-bold tracking-tight">ASTRA</span>
          <Badge tone="neutral">Staff</Badge>
        </Link>

        <SidebarNav />

        <div className="mt-auto border-t border-gray-100 pt-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-astra-light text-sm font-semibold text-astra-primary">
              {initial}
            </div>
            <p className="truncate text-xs text-gray-500" title={email}>
              {email}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="astra-fade-up flex-1 px-8 py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
