"use client";

import { useCallback, useEffect, useState } from "react";
import { IN_APP_ROUTES, IN_APP_ROUTE_LABELS, type InAppRoute } from "@astra/shared";
import { Card } from "@/app/_ui/card";
import { Button } from "@/app/_ui/button";
import { Field, Input, Textarea, Select } from "@/app/_ui/field";

const ROLES = [
  { value: "STUDENT", label: "Students" },
  { value: "PARTNER_MANAGER", label: "Partner venues" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admins" },
] as const;

interface Options {
  programmes: { code: string; name: string; count: number }[];
  studyYears: { year: number; count: number }[];
}
interface Recent {
  id: string;
  title: string;
  body: string;
  route: string | null;
  sentCount: number;
  userCount: number;
  sentBy: string | null;
  createdAt: string;
}
interface Preview {
  users: number;
  reachable: number;
  devices: number;
}

/** A filter chip. Multi-select; nothing selected means "no restriction". */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-astra-primary text-white"
          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export function PushComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState<InAppRoute | "">("");

  const [roles, setRoles] = useState<string[]>(["STUDENT"]);
  const [programmeCodes, setProgrammeCodes] = useState<string[]>([]);
  const [studyYears, setStudyYears] = useState<number[]>([]);

  const [options, setOptions] = useState<Options | null>(null);
  const [totalDevices, setTotalDevices] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const audience = useCallback(
    () => ({
      roles: roles.length ? roles : undefined,
      programmeCodes: programmeCodes.length ? programmeCodes : undefined,
      studyYears: studyYears.length ? studyYears : undefined,
    }),
    [roles, programmeCodes, studyYears],
  );

  async function load() {
    const res = await fetch("/api/admin/push", { credentials: "include" });
    const data = await res.json().catch(() => null);
    if (data) {
      setOptions(data.options);
      setTotalDevices(data.totalDevices ?? 0);
      setRecent(data.recent ?? []);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // Re-count on every filter change: the number of people about to be
  // interrupted should never be a surprise at the moment of sending.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title || "preview",
          body: body || "preview",
          audience: audience(),
          confirm: false,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!cancelled && data?.preview) setPreview(data.preview);
    })();
    return () => {
      cancelled = true;
    };
  }, [audience, title, body]);

  function toggle<T>(list: T[], set: (v: T[]) => void, v: T) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  const filtered =
    programmeCodes.length > 0 || studyYears.length > 0 || roles.length !== 1 || roles[0] !== "STUDENT";

  async function send() {
    const reach = preview?.reachable ?? 0;
    const who = filtered ? "the filtered audience" : "EVERY student with notifications on";
    if (
      !window.confirm(
        `Send "${title}" to ${who}?\n\n${reach} ${reach === 1 ? "person" : "people"} will be notified. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          body,
          route: route || null,
          audience: audience(),
          confirm: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
      setResult(
        `Sent to ${data.accepted} device${data.accepted === 1 ? "" : "s"} across ${data.userCount} ${
          data.userCount === 1 ? "person" : "people"
        }` +
          (data.failed
            ? ` · ${data.failed} failed${data.errors?.length ? ` (${data.errors[0]})` : ""}`
            : ""),
      );
      setTitle("");
      setBody("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !busy;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-5">
        <Card className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-800">Message</h2>
          <Field label="Title" required hint="Shown in bold on the lock screen">
            <Input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ASTRAWORLD is tomorrow"
            />
          </Field>
          <Field label="Message" required>
            <Textarea
              value={body}
              maxLength={300}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Doors at 12:00, Parco delle Memorie Industriali. Free entry."
            />
          </Field>
          <Field label="Opens" hint="Where the app goes when the notification is tapped">
            <Select value={route} onChange={(e) => setRoute(e.target.value as InAppRoute | "")}>
              <option value="">Just opens the app</option>
              {IN_APP_ROUTES.map((r) => (
                <option key={r} value={r}>
                  {IN_APP_ROUTE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Who gets it</h2>
            <p className="text-xs text-gray-400">
              Filters narrow the audience. Nothing selected in a row means no restriction on it.
            </p>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Role
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <Chip
                  key={r.value}
                  active={roles.includes(r.value)}
                  onClick={() => toggle(roles, setRoles, r.value)}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          {options && options.programmes.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Programme
              </div>
              <div className="flex flex-wrap gap-2">
                {options.programmes.map((p) => (
                  <Chip
                    key={p.code}
                    active={programmeCodes.includes(p.code)}
                    onClick={() => toggle(programmeCodes, setProgrammeCodes, p.code)}
                  >
                    {p.code} <span className="opacity-60">({p.count})</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {options && options.studyYears.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Year
              </div>
              <div className="flex flex-wrap gap-2">
                {options.studyYears.map((y) => (
                  <Chip
                    key={y.year}
                    active={studyYears.includes(y.year)}
                    onClick={() => toggle(studyYears, setStudyYears, y.year)}
                  >
                    Year {y.year} <span className="opacity-60">({y.count})</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="flex w-full flex-col gap-5 lg:w-80">
        <Card className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-800">Reach</h2>
          {preview ? (
            <>
              <div>
                <div className="text-3xl font-bold text-astra-primary">{preview.reachable}</div>
                <div className="text-xs text-gray-500">
                  will be notified, on {preview.devices} device
                  {preview.devices === 1 ? "" : "s"}
                </div>
              </div>
              {/* The gap between matched and reachable is people who never
                  turned notifications on. Saying so avoids "why only 118?" */}
              {preview.users > preview.reachable && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  {preview.users} match these filters, but{" "}
                  {preview.users - preview.reachable} have no device registered.
                </p>
              )}
              {!filtered && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No filters beyond &quot;Students&quot; — this goes to everyone.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Counting…</p>
          )}
          <p className="text-[11px] text-gray-400">{totalDevices} devices registered in total.</p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && <p className="text-sm text-green-700">{result}</p>}

          <Button onClick={send} disabled={!canSend} block>
            {busy ? "Sending…" : "Send notification"}
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-800">Recently sent</h2>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing sent yet.</p>
          ) : (
            recent.map((c) => (
              <div key={c.id} className="border-t border-gray-100 pt-2 first:border-0 first:pt-0">
                <div className="text-sm font-medium text-gray-800">{c.title}</div>
                <div className="text-xs text-gray-500">{c.body}</div>
                <div className="mt-1 text-[11px] text-gray-400">
                  {new Date(c.createdAt).toLocaleString("en-GB")} · {c.userCount} people
                  {c.sentBy ? ` · ${c.sentBy}` : ""}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
