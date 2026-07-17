import type { ReactNode } from "react";
import { PageHeader } from "@/app/_ui/page-header";
import { EmptyState } from "@/app/_ui/empty-state";

/**
 * Branded scaffold for dashboard sections that don't have their feature story
 * built yet. Renders the section header plus an on-brand "coming soon" empty
 * state (the web analog of the mobile ComingSoon screen).
 */
export function SectionPlaceholder({
  title,
  subtitle,
  icon,
  description,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  description: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState icon={icon} title={title} description={description} comingSoon />
    </>
  );
}
