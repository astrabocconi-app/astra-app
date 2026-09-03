"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashboardSection } from "@/lib/dashboard-pages";
import { pageIcon } from "./page-icons";

const STORAGE_KEY = "astra-dashboard-collapsed-sections";

function isActivePage(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Grouped into sections, because a flat list of fourteen links is a wall you
 * re-read every time instead of jumping to the group you want.
 *
 * Sections arrive already filtered to what this account may open, so nobody is
 * shown a link that would bounce them. Each section can be collapsed to cut
 * that wall down further; the section holding the current page is always
 * forced open so navigating never hides where you are.
 */
export function SidebarNav({ sections }: { sections: DashboardSection[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Best effort only; a failed write just means the state resets next visit.
      }
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-5">
      {sections.map((section) => {
        const isLoneOverview = section.key === "overview";
        const hasActivePage = section.pages.some((page) => isActivePage(pathname, page.href));
        const isOpen = isLoneOverview || hasActivePage || !collapsed.has(section.key);

        return (
          <div key={section.key} className="flex flex-col gap-0.5">
            {/* No heading above a lone Overview link. */}
            {!isLoneOverview && (
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                aria-expanded={isOpen}
                className="flex items-center justify-between px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
              >
                {section.label}
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}

            {isOpen &&
              section.pages.map((page) => {
                const active = isActivePage(pathname, page.href);
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
        );
      })}
    </nav>
  );
}
