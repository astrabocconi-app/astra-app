/** Button — brand-filled primary + subtle secondary, matching mobile buttons. */
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
};

/** The shared look, so a link can wear it without nesting a button inside an anchor. */
export function buttonClass(variant: Variant = "primary", block = false, extra = "") {
  const styles =
    variant === "primary"
      ? "bg-astra-primary text-white hover:bg-astra-dark active:bg-astra-dark"
      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50";
  return `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${
    block ? "w-full" : ""
  } ${extra}`;
}

export function Button({
  variant = "primary",
  block = false,
  className = "",
  type = "button",
  ...props
}: Props) {
  return <button type={type} className={buttonClass(variant, block, className)} {...props} />;
}

/** A navigation link that looks like a Button (one tab stop, valid markup). */
export function ButtonLink({
  variant = "primary",
  block = false,
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; block?: boolean }) {
  return <Link className={buttonClass(variant, block, className)} {...props} />;
}
