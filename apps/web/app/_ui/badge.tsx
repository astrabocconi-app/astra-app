/** Pill / badge — the light-tint role chip from the mobile profile screen. */
import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "neutral";
}) {
  const cls =
    tone === "brand"
      ? "bg-astra-light text-astra-primary"
      : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}
