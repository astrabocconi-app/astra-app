"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/app/_ui/button";

/** Re-fetches the server data for this page in place, without a full reload. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
