import { redirect } from "next/navigation";

// Entry point — the dashboard layout handles auth (redirects to /signin when
// there's no session), so send everything there.
export default function Home() {
  redirect("/dashboard");
}
