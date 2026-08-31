// The dashboard's map of itself: every page, grouped into sections.
//
// One list drives three things that must never disagree — the sidebar, the
// permission editor, and the server-side access check. If a page were added to
// the sidebar but not here it would be unguarded, so the sidebar is generated
// from this rather than written alongside it.

export interface DashboardPage {
  /** Stored in User.dashboardPages. Never change one without a migration. */
  key: string;
  label: string;
  href: string;
  /** Shown in the permission editor so the choice is understandable. */
  blurb: string;
}

export interface DashboardSection {
  key: string;
  label: string;
  pages: DashboardPage[];
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    key: "overview",
    label: "Overview",
    pages: [
      {
        key: "overview",
        label: "Overview",
        href: "/dashboard",
        blurb: "Headline numbers for the association",
      },
    ],
  },
  {
    key: "content",
    label: "Content",
    pages: [
      { key: "news", label: "News", href: "/dashboard/news", blurb: "Write and publish posts" },
      {
        key: "events",
        label: "Events",
        href: "/dashboard/events",
        blurb: "Create events students can see",
      },
      {
        key: "astraworld",
        label: "AstraWorld",
        href: "/dashboard/astraworld",
        blurb: "Edit the festival page in the app",
      },
      {
        key: "materials",
        label: "Materials",
        href: "/dashboard/materials",
        blurb: "Course handouts (read-only)",
      },
    ],
  },
  {
    key: "engagement",
    label: "Points & rewards",
    pages: [
      {
        key: "rewards",
        label: "Rewards",
        href: "/dashboard/rewards",
        blurb: "The catalogue and its voucher codes",
      },
      {
        key: "redemptions",
        label: "Redemptions",
        href: "/dashboard/redemptions",
        blurb: "Hand over rewards, or refund them",
      },
      {
        key: "points",
        label: "Points",
        href: "/dashboard/points",
        blurb: "Adjust balances by hand",
      },
      {
        key: "push",
        label: "Notifications",
        href: "/dashboard/push",
        blurb: "Send push notifications to students",
      },
    ],
  },
  {
    key: "partners",
    label: "Partners",
    pages: [
      {
        key: "partners",
        label: "Venues",
        href: "/dashboard/partners",
        blurb: "Partner venues and their offers",
      },
      {
        key: "partner-logins",
        label: "Venue logins",
        href: "/dashboard/partner-logins",
        blurb: "Accounts venue staff use to scan",
      },
    ],
  },
  {
    key: "people",
    label: "People",
    pages: [
      { key: "users", label: "Students", href: "/dashboard/users", blurb: "Registered students" },
      {
        key: "support",
        label: "Support",
        href: "/dashboard/support",
        blurb: "Messages sent from the app",
      },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    pages: [
      {
        key: "team",
        label: "Team",
        href: "/dashboard/team",
        blurb: "Backoffice accounts and their access",
      },
      {
        key: "audit",
        label: "Audit log",
        href: "/dashboard/audit",
        blurb: "Who changed what, and when",
      },
    ],
  },
];

export const DASHBOARD_PAGES: DashboardPage[] = DASHBOARD_SECTIONS.flatMap((s) => s.pages);
export const ALL_PAGE_KEYS: string[] = DASHBOARD_PAGES.map((p) => p.key);

export function pageByKey(key: string): DashboardPage | undefined {
  return DASHBOARD_PAGES.find((p) => p.key === key);
}

/**
 * Pages that stay admin-only whatever is ticked.
 *
 * Team is the obvious one: an account that can edit its own permissions has no
 * permissions. Audit is here because a person who can hide their own trail can
 * do anything else unobserved.
 */
export const ADMIN_ONLY_PAGES = new Set(["team", "audit"]);
