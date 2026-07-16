import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

// Planned dashboard sections. Pages fill in as feature stories land.
const NAV = [
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/points", label: "Points" },
  { href: "/dashboard/rewards", label: "Rewards" },
  { href: "/dashboard/partners", label: "Partners" },
  { href: "/dashboard/audit", label: "Audit log" },
] as const;

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
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900">No dashboard access</h1>
        <p className="text-gray-500">
          Signed in as {session.user.email}, but this account has no staff role.
          Ask an admin to grant access.
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 p-4">
        <Link href="/dashboard" className="mb-6 block text-lg font-semibold" style={{ color: "#04107E" }}>
          ASTRA
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 truncate text-xs text-gray-400">{session.user.email}</p>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
