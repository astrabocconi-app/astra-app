/** Button — brand-filled primary + subtle secondary, matching mobile buttons. */
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  block?: boolean;
};

export function Button({
  variant = "primary",
  block = false,
  className = "",
  ...props
}: Props) {
  const styles =
    variant === "primary"
      ? "bg-astra-primary text-white hover:bg-astra-dark active:bg-astra-dark"
      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${
        block ? "w-full" : ""
      } ${className}`}
      {...props}
    />
  );
}
