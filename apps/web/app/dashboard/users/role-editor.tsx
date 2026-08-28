"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ALL_ROLES = ["STUDENT", "STAFF", "AREA_MANAGER", "ADMIN", "PARTNER_MANAGER"] as const;
type RoleName = (typeof ALL_ROLES)[number];

const LABEL: Record<RoleName, string> = {
  STUDENT: "Student",
  STAFF: "Staff",
  AREA_MANAGER: "Area manager",
  ADMIN: "Admin",
  PARTNER_MANAGER: "Partner",
};

/**
 * Inline role editor. Opens on click so the table stays readable, and saves the
 * whole role set at once (the API validates it and refuses to leave the system
 * without an admin).
 */
export function RoleEditor({ userId, roles }: { userId: string; roles: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoleName[]>(roles as RoleName[]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(role: RoleName) {
    setDraft((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roles: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't save roles.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save roles.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setDraft(roles as RoleName[]);
          setError(null);
          setOpen(true);
        }}
        className="text-xs font-medium text-astra-accent hover:text-astra-primary"
      >
        Edit roles
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {ALL_ROLES.map((r) => {
          const on = draft.includes(r);
          return (
            <button
              key={r}
              onClick={() => toggle(r)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                on
                  ? "bg-astra-primary text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {LABEL[r]}
            </button>
          );
        })}
      </div>
      {error && <span className="max-w-[16rem] text-right text-xs text-red-600">{error}</span>}
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || draft.length === 0}
          className="text-xs font-semibold text-astra-primary disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
