import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUserCached } from "../dashboard/_lib/session";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

// Backoffice roles, same list as the dashboard layout.
const STAFF_ROLES = ["ADMIN", "AREA_MANAGER", "STAFF"];

/** Only ever send people back into the dashboard, never to another site. */
function safeNext(next: string | undefined) {
  return next && /^\/dashboard(\/|\?|$)/.test(next) && !next.includes("//") ? next : "/dashboard";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);

  // Already signed in as backoffice: nothing to do here.
  const session = await getSessionUserCached();
  if (session?.user.roles.some((r) => STAFF_ROLES.includes(r))) redirect(target);

  return <SignInForm next={target} />;
}
