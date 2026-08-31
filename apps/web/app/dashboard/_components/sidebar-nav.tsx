"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DashboardSection } from "@/lib/dashboard-pages";
import { pageIcon } from "./page-icons";

/**
 * Grouped into sections, because a flat list of fourteen links is a wall you
 * re-read every time instead of jumping to the group you want.
 *
 * Sections arrive already filtered to what this account may open, so nobody is
 * shown a link that would bounce them.
 */
export function SidebarNav({ sections }: { sections: DashboardSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-0.5">
          {/* No heading above a lone Overview link. */}
          {section.key !== "overview" && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {section.label}
            </p>
          )}

          {section.pages.map((page) => {
            const active =
              page.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(page.href);
            return (
              <Link
                key={page.key}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-astra-light font-semibold text-astra-primary"
                    : "font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={active ? "text-astra-primary" : "text-gray-400"}>
                  {pageIcon(page.key)}
                </span>
                {page.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
