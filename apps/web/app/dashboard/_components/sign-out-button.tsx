"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LogoutIcon } from "@/app/_ui/icons";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setLoading(true);
    setFailed(false);
    try {
      await authClient.signOut();
      router.replace("/signin");
    } catch {
      // Still signed in: say so rather than pretending, and let them retry.
      setFailed(true);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        <LogoutIcon size={16} />
        {loading ? "Signing out…" : "Sign out"}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600">
          Couldn&apos;t sign out. Check your connection and try again.
        </p>
      )}
    </>
  );
}
