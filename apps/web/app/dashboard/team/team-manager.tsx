"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/_ui/button";
import { Badge } from "@/app/_ui/badge";
import { Field, Input } from "@/app/_ui/field";
import { EmptyState } from "@/app/_ui/empty-state";
import { ShieldIcon, PlusIcon } from "@/app/_ui/icons";
import { PermissionFlow, GRANTABLE_KEYS, GRANTABLE_SECTIONS } from "./permission-flow";
import { romeDate } from "@/app/_ui/rome";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";

export interface StaffRow {
  id: string;
  username: string;
  name: string | null;
  pages: string[];
  createdAt: string;
  lastSignInAt: string | null;
}

/**
 * Two shortcuts: every page a staff account can be given (never Team or Audit log,
 * which stay admin-only), or a blank slate. Neither makes the account an admin.
 */
function AccessPresets({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const isFull = value.length === GRANTABLE_KEYS.length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={isFull ? "primary" : "secondary"}
        onClick={() => onChange([...GRANTABLE_KEYS])}
      >
        All pages
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([])}
        disabled={value.length === 0}
      >
        Clear selection
      </Button>
      <span className="text-xs text-gray-500">
        {value.length} of {GRANTABLE_KEYS.length} pages. Team and Audit log are admin-only.
      </span>
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/api/admin/staff", { method: "POST", body: { username, name, password, pages } });
      setUsername("");
      setName("");
      setPassword("");
      setPages([]);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not create the account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Username" required hint="Lowercase. This is what they type to sign in.">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="giulia"
            autoComplete="off"
            required
            minLength={3}
          />
        </Field>
        <Field label="Full name" hint="Shown in the audit log.">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Giulia Rossi"
            autoComplete="off"
          />
        </Field>
        <Field label="Password" required hint="At least 10 characters. Send it to them yourself.">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="text"
            placeholder="a long passphrase"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <AccessPresets value={pages} onChange={setPages} />
        <PermissionFlow value={pages} onChange={setPages} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy || password.length < 10 || !username.trim()}>
          {busy ? "Creating…" : "Create account"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AccountCard({ account, onChanged }: { account: StaffRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<string[]>(account.pages);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    password.length > 0 ||
    pages.length !== account.pages.length ||
    pages.some((p) => !account.pages.includes(p));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/staff/${account.id}`, {
        method: "PATCH",
        body: password ? { pages, password } : { pages },
      });
      setPassword("");
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (
      !confirm(
        `Revoke ${account.username}? They will be signed out and will not be able to sign in again. What they did stays in the audit log.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/staff/${account.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not revoke the account."));
    } finally {
      setBusy(false);
    }
  };

  const sectionSummary = GRANTABLE_SECTIONS.filter((s) =>
    s.pages.some((p) => account.pages.includes(p.key)),
  );
  const full = account.pages.length === GRANTABLE_KEYS.length;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-astra-light text-sm font-semibold uppercase text-astra-primary">
          {account.username.charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{account.username}</span>
            {full ? (
              <Badge tone="brand">Everything</Badge>
            ) : account.pages.length === 0 ? (
              <Badge tone="neutral">No access</Badge>
            ) : (
              <Badge tone="neutral">{account.pages.length} pages</Badge>
            )}
          </span>
          <span className="block truncate text-sm text-gray-500">
            {account.name && account.name !== account.username ? `${account.name} · ` : ""}
            {sectionSummary.length > 0
              ? sectionSummary.map((s) => s.label).join(", ")
              : "nothing assigned"}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs text-gray-500 sm:block">
          {account.lastSignInAt
            ? `last in ${romeDate(account.lastSignInAt)}`
            : "never signed in"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-gray-100 px-5 py-5">
          <AccessPresets
            value={pages}
            onChange={(v) => {
              setPages(v);
              setSaved(false);
            }}
          />
          <PermissionFlow
            value={pages}
            onChange={(v) => {
              setPages(v);
              setSaved(false);
            }}
            disabled={busy}
          />

          <div className="max-w-sm">
            <Field
              label="Set a new password"
              hint="Leave blank to keep the current one. At least 10 characters. Saving a new one signs them out everywhere."
            >
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="text"
                placeholder="—"
                autoComplete="new-password"
              />
            </Field>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} disabled={busy || !dirty || (password.length > 0 && password.length < 10)}>
              {busy ? "Saving…" : saved && !dirty ? "Saved" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={revoke}
              disabled={busy}
              className="!text-red-600"
            >
              Revoke access
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamManager({ accounts }: { accounts: StaffRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const refresh = useCallback(() => {
    setCreating(false);
    router.refresh();
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <CreateForm onDone={refresh} />
      ) : (
        <div>
          <Button type="button" onClick={() => setCreating(true)}>
            <PlusIcon size={16} />
            New account
          </Button>
        </div>
      )}

      {accounts.length === 0 && !creating ? (
        <EmptyState
          icon={<ShieldIcon size={28} />}
          title="No staff accounts yet"
          description="Create one for each person who needs the backoffice, and tick only the pages they work on."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((a) => (
            // Keyed on the page list as well as the id so the editor resets to
            // what was saved after a refresh, instead of holding stale state.
            <AccountCard key={`${a.id}:${a.pages.join(",")}`} account={a} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
