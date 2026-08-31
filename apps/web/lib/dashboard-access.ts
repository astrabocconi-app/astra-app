// Who may open which dashboard page. SERVER-ONLY.
//
// The sidebar hides what you cannot use, but hiding is not access control: the
// URL is still typeable. Every page calls requirePage(), so the check happens
// where the data is read rather than where the link is drawn.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import { isAdmin } from "./authz";
import { ADMIN_ONLY_PAGES, ALL_PAGE_KEYS, DASHBOARD_SECTIONS, type DashboardSection } from "./dashboard-pages";

export function canAccessPage(session: SessionUser, pageKey: string): boolean {
  // Admins see everything, including the pages nobody else can be granted.
  if (isAdmin(session.actor)) return true;
  if (ADMIN_ONLY_PAGES.has(pageKey)) return false;
  return (session.user.dashboardPages ?? []).includes(pageKey);
}

export function allowedPageKeys(session: SessionUser): string[] {
  if (isAdmin(session.actor)) return ALL_PAGE_KEYS;
  return (session.user.dashboardPages ?? []).filter(
    (k) => ALL_PAGE_KEYS.includes(k) && !ADMIN_ONLY_PAGES.has(k),
  );
}

/** Sections filtered to what this account may open, empty ones dropped. */
export function visibleSections(session: SessionUser): DashboardSection[] {
  const allowed = new Set(allowedPageKeys(session));
  return DASHBOARD_SECTIONS.map((s) => ({
    ...s,
    pages: s.pages.filter((p) => allowed.has(p.key)),
  })).filter((s) => s.pages.length > 0);
}

/**
 * Guard at the top of a dashboard page. Returns the session so the page can use
 * it without resolving it twice.
 *
 * Sends someone who lacks this page to their own first page rather than to a
 * dead end — being handed a landing spot beats being told no.
 */
export async function requirePage(pageKey: string): Promise<SessionUser> {
  const session = await getSessionUser(await headers());
  if (!session) redirect("/signin");
  if (!canAccessPage(session, pageKey)) {
    const fallback = visibleSections(session)[0]?.pages[0]?.href;
    redirect(fallback && fallback !== "/dashboard" ? fallback : "/dashboard/no-access");
  }
  return session;
}
