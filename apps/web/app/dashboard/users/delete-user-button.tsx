"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";

// Deletes a student's account (anonymised, as in the app). Admin only — the
// page only renders this for the admin, and the API checks again.
export function DeleteUserButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (
      !confirm(
        `Delete ${email}? Their profile, sessions and devices are removed and they are signed out everywhere. Their points history stays, anonymised. This can't be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Could not delete the account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <span role="alert" className="max-w-48 text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
