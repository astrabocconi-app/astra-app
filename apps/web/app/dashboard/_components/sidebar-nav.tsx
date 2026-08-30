"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  HomeIcon,
  UsersIcon,
  BookIcon,
  CalendarIcon,
  CoinsIcon,
  GiftIcon,
  StoreIcon,
  AuditIcon,
  NewspaperIcon,
  SupportIcon,
} from "@/app/_ui/icons";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/dashboard", label: "Overview", icon: <HomeIcon size={20} /> },
  { href: "/dashboard/news", label: "News", icon: <NewspaperIcon size={20} /> },
  { href: "/dashboard/events", label: "Events", icon: <CalendarIcon size={20} /> },
  { href: "/dashboard/rewards", label: "Rewards", icon: <GiftIcon size={20} /> },
  { href: "/dashboard/users", label: "Users", icon: <UsersIcon size={20} /> },
  { href: "/dashboard/materials", label: "Materials", icon: <BookIcon size={20} /> },
  { href: "/dashboard/points", label: "Points", icon: <CoinsIcon size={20} /> },
  { href: "/dashboard/partners", label: "Partners", icon: <StoreIcon size={20} /> },
  { href: "/dashboard/partner-logins", label: "Partner logins", icon: <UsersIcon size={20} /> },
  { href: "/dashboard/support", label: "Support", icon: <SupportIcon size={20} /> },
  { href: "/dashboard/audit", label: "Audit log", icon: <AuditIcon size={20} /> },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-astra-light text-astra-primary"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span className={active ? "text-astra-primary" : "text-gray-400"}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
