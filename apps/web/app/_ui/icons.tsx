/**
 * Inline SVG icon set for the ASTRA dashboard.
 *
 * Outline style (stroke = currentColor, round caps/joins) to match the
 * Ionicons-outline look used across the mobile app — no icon-library
 * dependency. Size + color are controlled by the parent's font-size and
 * text color; pass `className` for anything else.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function NewspaperIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M4 5h13v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Z" />
      <path d="M17 8h3v10a2 2 0 0 1-2 2" />
      <path d="M7 8h7M7 12h7M7 16h4" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" />
      <path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5Z" />
      <path d="M9 7.5h6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <ellipse cx="9" cy="6.5" rx="5.5" ry="2.5" />
      <path d="M3.5 6.5v5c0 1.4 2.46 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5" />
      <path d="M3.5 11.5v5c0 1.4 2.46 2.5 5.5 2.5 1.02 0 1.98-.12 2.8-.34" />
      <circle cx="16.5" cy="15.5" r="4.5" />
    </svg>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <rect x="3.5" y="8" width="17" height="4.5" rx="1" />
      <path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5M12 8v13" />
      <path d="M12 8S10.5 3.5 8 3.5 5.5 8 8 8h4Zm0 0s1.5-4.5 4-4.5S18.5 8 16 8h-4Z" />
    </svg>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M4 4.5h16l1 5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-3-.5Z" />
      <path d="M5 11v9h14v-9" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function AuditIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M14 4.5H7A1.5 1.5 0 0 0 5.5 6v12A1.5 1.5 0 0 0 7 19.5h7" />
      <path d="M15 8.5 19.5 12 15 15.5M9.5 12h10" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)} aria-hidden="true">
      <path d="M12 3.5c.4 4.2 1.8 5.6 6 6-4.2.4-5.6 1.8-6 6-.4-4.2-1.8-5.6-6-6 4.2-.4 5.6-1.8 6-6Z" />
      <path d="M18.5 14.5c.2 1.6.7 2.1 2.3 2.3-1.6.2-2.1.7-2.3 2.3-.2-1.6-.7-2.1-2.3-2.3 1.6-.2 2.1-.7 2.3-2.3Z" />
    </svg>
  );
}
