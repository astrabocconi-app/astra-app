import Link from "next/link";

// Planned dashboard sections. All pages are placeholders in the scaffold.
const NAV = [
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/points", label: "Points" },
  { href: "/dashboard/rewards", label: "Rewards" },
  { href: "/dashboard/partners", label: "Partners" },
  { href: "/dashboard/audit", label: "Audit log" },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 p-4">
        <Link href="/dashboard" className="mb-6 block text-lg font-semibold">
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
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
