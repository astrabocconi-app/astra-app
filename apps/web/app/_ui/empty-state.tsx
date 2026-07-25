/**
 * EmptyState — the web analog of the mobile app's ComingSoon component:
 * an icon in a light-tint rounded square, a title, a description, and an
 * optional "Coming soon" eyebrow. Used for not-yet-built dashboard sections.
 */
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  comingSoon = false,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  comingSoon?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white/60 px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-astra-light text-astra-primary">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-astra-primary">{title}</h2>
      <p className="max-w-md text-sm text-gray-500">{description}</p>
      {comingSoon && (
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
          Coming soon
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
