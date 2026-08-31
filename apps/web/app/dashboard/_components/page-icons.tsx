// One icon per dashboard page key.
//
// Kept apart from lib/dashboard-pages.ts, which is the plain-data registry that
// server code and the permission editor both import: putting JSX in there would
// drag React into modules that have no need of it. Kept apart from the sidebar
// too, because the Overview page draws the same set of cards.

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
  BellIcon,
  SparkleIcon,
  ShieldIcon,
  KeyIcon,
} from "@/app/_ui/icons";

export function pageIcon(key: string, size = 18): ReactNode {
  switch (key) {
    case "overview":
      return <HomeIcon size={size} />;
    case "news":
      return <NewspaperIcon size={size} />;
    case "events":
      return <CalendarIcon size={size} />;
    case "astraworld":
      return <SparkleIcon size={size} />;
    case "materials":
      return <BookIcon size={size} />;
    case "rewards":
    case "redemptions":
      return <GiftIcon size={size} />;
    case "points":
      return <CoinsIcon size={size} />;
    case "push":
      return <BellIcon size={size} />;
    case "partners":
      return <StoreIcon size={size} />;
    case "partner-logins":
      return <KeyIcon size={size} />;
    case "users":
      return <UsersIcon size={size} />;
    case "support":
      return <SupportIcon size={size} />;
    case "team":
      return <ShieldIcon size={size} />;
    case "audit":
      return <AuditIcon size={size} />;
    default:
      return <HomeIcon size={size} />;
  }
}
