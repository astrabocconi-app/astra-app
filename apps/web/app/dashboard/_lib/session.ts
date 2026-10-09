// Per-request session helpers for dashboard server components.
//
// A navigation runs the dashboard layout, a section layout and the page, each of
// which needs the session. cache() makes the second and third calls free.
// Next.js can skip layouts on partial renders, so every page.tsx calls
// requireDashboardPage() itself; the layouts keep the same check for UX.

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { canAccessPage, visibleSections } from "@/lib/dashboard-access";

export const getSessionUserCached = cache(
  async (): Promise<SessionUser | null> => getSessionUser(await headers()),
);

/**
 * Same contract as lib/dashboard-access `requirePage`, on the cached session:
 * signed out → /signin, lacking the page → the first page the account does have.
 */
export async function requireDashboardPage(pageKey: string): Promise<SessionUser> {
  const session = await getSessionUserCached();
  if (!session) redirect("/signin");
  if (!canAccessPage(session, pageKey)) {
    const fallback = visibleSections(session)[0]?.pages[0]?.href;
    redirect(fallback && fallback !== "/dashboard" ? fallback : "/dashboard/no-access");
  }
  return session;
}
