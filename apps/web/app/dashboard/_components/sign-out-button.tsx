"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LogoutIcon } from "@/app/_ui/icons";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await authClient.signOut();
    router.replace("/signin");
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
    >
      <LogoutIcon size={16} />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
