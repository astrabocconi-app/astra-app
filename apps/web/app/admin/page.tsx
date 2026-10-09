import { redirect } from "next/navigation";

// The old backoffice address. Sign-in lives at /signin; this keeps old bookmarks
// and the instructions some staff were given working.
export default function AdminRedirect() {
  redirect("/signin");
}
