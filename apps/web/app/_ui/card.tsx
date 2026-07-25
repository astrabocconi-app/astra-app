/** Surface primitives — the rounded-2xl card vocabulary from the mobile app. */
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * StatCard — a single headline metric. `tone="brand"` renders the filled
 * deep-blue card used for the hero metric (mirrors the mobile points card).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "plain",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "plain" | "brand";
}) {
  const brand = tone === "brand";
  return (
    <div
      className={
        brand
          ? "rounded-2xl bg-astra-primary p-5 text-white shadow-sm"
          : "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            brand ? "text-white/70" : "text-gray-500"
          }`}
        >
          {label}
        </p>
        {icon && (
          <span className={brand ? "text-white/80" : "text-astra-accent"}>
            {icon}
          </span>
        )}
      </div>
      <p
        className={`mt-2 text-3xl font-bold ${
          brand ? "text-white" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className={`mt-1 text-xs ${brand ? "text-white/60" : "text-gray-400"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
