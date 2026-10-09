"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Badge } from "@/app/_ui/badge";
import { Field, Input, Select, Toggle } from "@/app/_ui/field";
import { PlusIcon } from "@/app/_ui/icons";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";

export interface PartnerOption {
  id: string;
  name: string;
}

export interface AccountRow {
  id: string;
  partnerId: string;
  partnerName: string;
  loginCode: string;
  label: string | null;
  scanOnly: boolean;
  /** The venue was deleted but this login still exists: it should be revoked. */
  venueDeleted: boolean;
}

const send = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) =>
  adminFetch(path, { method, body });

/** Readable, typo-resistant on a phone keypad — no ambiguous 0/O or 1/l. */
function suggestPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

function AccessBadge({ scanOnly }: { scanOnly: boolean }) {
  return (
    <Badge tone={scanOnly ? "neutral" : "brand"}>{scanOnly ? "Scan only" : "Full access"}</Badge>
  );
}

function NewAccountForm({
  partners,
  onDone,
}: {
  partners: PartnerOption[];
  onDone: () => void;
}) {
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [loginCode, setLoginCode] = useState("");
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState(suggestPassword());
  const [scanOnly, setScanOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; password: string } | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await send("/api/admin/partner-accounts", "POST", {
        partnerId,
        loginCode,
        password,
        label,
        scanOnly,
      });
      // Surface the credentials once — the password is hashed on save and can
      // never be read back, only reset.
      setCreated({ code: loginCode.trim().toLowerCase(), password });
      setLoginCode("");
      setLabel("");
      setPassword(suggestPassword());
      setScanOnly(false);
      onDone();
    } catch (e) {
      setError(errorMessage(e, "Couldn't create the account."));
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <Card className="flex flex-col gap-3 border-green-200 bg-green-50">
        <h2 className="text-sm font-semibold text-green-900">Account created</h2>
        <p className="text-xs text-green-800">
          Give these to the venue now — the password is hashed and can&apos;t be shown again, only
          reset.
        </p>
        <div className="rounded-xl bg-white p-4 font-mono text-sm">
          <div>
            Login code: <span className="font-semibold">{created.code}</span>
          </div>
          <div>
            Password: <span className="font-semibold">{created.password}</span>
          </div>
        </div>
        <div>
          <Button variant="secondary" onClick={() => setCreated(null)}>
            Add another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">New login</h2>
        <p className="text-xs text-gray-500">
          A venue can have as many logins as it needs — one per till, per shift, however they work.
          Scans are recorded against the specific login that made them.
        </p>
      </div>

      <Field label="Venue" required>
        <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Login code" required hint="What staff type to sign in. Lowercase, no spaces.">
          <Input
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            placeholder="e.g. casadimichele-bar"
            autoComplete="off"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Label" hint="Only to tell logins apart in this list.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Bar" />
        </Field>
      </div>

      <Field label="Password" required hint="At least 8 characters. Shown once after saving.">
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          <Button variant="secondary" onClick={() => setPassword(suggestPassword())}>
            Regenerate
          </Button>
        </div>
      </Field>

      <Toggle
        label="Scan only"
        hint="Can award points but never sees takings or analytics."
        checked={scanOnly}
        onChange={setScanOnly}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving || !partnerId || loginCode.trim().length < 3 || password.length < 8}
        >
          {saving ? "Creating…" : "Create login"}
        </Button>
      </div>
    </Card>
  );
}

function AccountRowItem({ account, onChanged }: { account: AccountRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetTo, setResetTo] = useState<string | null>(null);

  async function toggleScanOnly() {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/admin/partner-accounts/${account.id}`, "PATCH", {
        scanOnly: !account.scanOnly,
      });
      onChanged();
    } catch (e) {
      setError(errorMessage(e, "Couldn't update."));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (
      !confirm(
        `Reset the password for "${account.loginCode}"? The current password stops working at once and anyone signed in with this login is signed out, so the venue needs the new password before their next scan.`,
      )
    ) {
      return;
    }
    const next = suggestPassword();
    setBusy(true);
    setError(null);
    try {
      await send(`/api/admin/partner-accounts/${account.id}`, "PATCH", { password: next });
      setResetTo(next);
      onChanged();
    } catch (e) {
      setError(errorMessage(e, "Couldn't reset the password."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Revoke the login "${account.loginCode}"? Staff using it are signed out and can't sign in again. You can create a new login with the same code afterwards.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send(`/api/admin/partner-accounts/${account.id}`, "DELETE");
      onChanged();
    } catch (e) {
      setError(errorMessage(e, "Couldn't revoke the login."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-mono font-medium text-gray-900">{account.loginCode}</span>
          {account.label && <span className="ml-2 text-sm text-gray-500">{account.label}</span>}
        </div>
        {account.venueDeleted && <Badge tone="neutral">Venue deleted</Badge>}
        <AccessBadge scanOnly={account.scanOnly} />
        <button
          type="button"
          onClick={toggleScanOnly}
          disabled={busy}
          className="text-xs font-medium text-astra-accent hover:text-astra-primary disabled:opacity-40"
        >
          {account.scanOnly ? "Give full access" : "Make scan only"}
        </button>
        <button
          type="button"
          onClick={resetPassword}
          disabled={busy}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          Reset password
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
        >
          Revoke
        </button>
      </div>
      {resetTo && (
        <p className="rounded-lg bg-green-50 px-3 py-2 font-mono text-xs text-green-900">
          New password: <span className="font-semibold">{resetTo}</span> — copy it now, it
          can&apos;t be shown again.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function PartnerAccountManager({
  partners,
  accounts,
}: {
  partners: PartnerOption[];
  accounts: AccountRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const refresh = () => router.refresh();

  const byPartner = new Map<string, AccountRow[]>();
  for (const a of accounts) {
    if (!byPartner.has(a.partnerId)) byPartner.set(a.partnerId, []);
    byPartner.get(a.partnerId)!.push(a);
  }

  return (
    <div className="flex flex-col gap-6">
      {adding ? (
        <NewAccountForm
          partners={partners}
          onDone={() => {
            refresh();
          }}
        />
      ) : (
        <div>
          <Button onClick={() => setAdding(true)} disabled={partners.length === 0}>
            <PlusIcon size={18} /> New login
          </Button>
          {partners.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">Add a partner venue first.</p>
          )}
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
          No venue logins yet. Create one and hand the code and password to the venue.
        </p>
      ) : (
        [...byPartner.entries()].map(([partnerId, rows]) => (
          <section key={partnerId} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-800">{rows[0]!.partnerName}</h2>
              <span className="text-xs text-gray-500">
                {rows.length === 1 ? "1 login" : `${rows.length} logins`}
              </span>
            </div>
            {rows.map((a) => (
              <AccountRowItem key={a.id} account={a} onChanged={refresh} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
