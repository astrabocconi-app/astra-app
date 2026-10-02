"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deletes a student's account (anonymised, as in the app). Admin only — the
// page only renders this for the admin, and the API checks again.
export function DeleteUserButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (
      !confirm(
        `Delete ${email}? Their profile, sessions and devices are removed and they are signed out everywhere. Their points history stays, anonymised. This can't be undone.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      alert(body?.error?.message ?? "Could not delete the account.");
      return;
    }
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
