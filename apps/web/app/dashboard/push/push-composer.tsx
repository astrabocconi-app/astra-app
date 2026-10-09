"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IN_APP_ROUTES, IN_APP_ROUTE_LABELS, type InAppRoute } from "@astra/shared";
import { Card } from "@/app/_ui/card";
import { Button } from "@/app/_ui/button";
import { Counter, Field, Input, Textarea, Select } from "@/app/_ui/field";
import { romeDateTime } from "@/app/_ui/rome";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";

const ROLES = [
  { value: "STUDENT", label: "Students" },
  { value: "PARTNER_MANAGER", label: "Partner venues" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admins" },
] as const;
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const TITLE_MAX = 80;
const BODY_MAX = 300;

interface Options {
  programmes: { code: string; name: string; count: number }[];
  studyYears: { year: number; count: number }[];
  classGroups: { id: string; code: string; programmeCode: string; count: number }[];
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
interface Audience {
  roles: string[];
  programmeCodes?: string[];
  studyYears?: number[];
  classGroupIds?: string[];
}
/** A finished preview, tagged with the audience it was counted for. */
interface Counted {
  key: string;
  total: Preview;
  /** Reachable people per role; only filled when more than one role is picked. */
  byRole: { role: string; reachable: number }[];
}

/** A filter chip. Multi-select. */
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
      aria-pressed={active}
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

async function countAudience(audience: Audience, signal?: AbortSignal): Promise<Preview> {
  const data = await adminFetch<{ preview?: Preview }>("/api/admin/push", {
    method: "POST",
    signal,
    body: { title: "preview", body: "preview", audience, confirm: false },
  });
  if (!data.preview) throw new Error("The server did not return a count.");
  return data.preview;
}

export function PushComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState<InAppRoute | "">("");

  // At least one role is always selected: the server refuses an empty list, and
  // "no role" must never be read as "everyone".
  const [roles, setRoles] = useState<string[]>(["STUDENT"]);
  const [programmeCodes, setProgrammeCodes] = useState<string[]>([]);
  const [studyYears, setStudyYears] = useState<number[]>([]);
  const [classGroupIds, setClassGroupIds] = useState<string[]>([]);

  const [options, setOptions] = useState<Options | null>(null);
  const [totalDevices, setTotalDevices] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [counted, setCounted] = useState<Counted | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; tone: "ok" | "warn" | "fail" } | null>(null);

  const audience = useMemo<Audience>(
    () => ({
      roles,
      programmeCodes: programmeCodes.length ? programmeCodes : undefined,
      studyYears: studyYears.length ? studyYears : undefined,
      classGroupIds: classGroupIds.length ? classGroupIds : undefined,
    }),
    [roles, programmeCodes, studyYears, classGroupIds],
  );
  const audienceKey = JSON.stringify(audience);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await adminFetch<{ options?: Options; totalDevices?: number; recent?: Recent[] }>("/api/admin/push");
      setOptions(data.options ?? null);
      setTotalDevices(data.totalDevices ?? 0);
      setRecent(data.recent ?? []);
    } catch (e) {
      setLoadError(errorMessage(e, "Couldn't load the filters and recent sends."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Re-count when the AUDIENCE changes (not on every keystroke of the text), after a
  // short pause: the number of people about to be interrupted should never be a
  // surprise at the moment of sending.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewError(null);
      try {
        const [total, ...per] = await Promise.all([
          countAudience(audience, ctrl.signal),
          ...(audience.roles.length > 1
            ? audience.roles.map((r) => countAudience({ ...audience, roles: [r] }, ctrl.signal))
            : []),
        ]);
        setCounted({
          key: audienceKey,
          total,
          byRole: per.map((p, i) => ({ role: audience.roles[i] ?? "", reachable: p.reachable })),
        });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setPreviewError(errorMessage(e, "Couldn't count who would be notified."));
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [audience, audienceKey]);

  function toggle<T>(list: T[], set: (v: T[]) => void, v: T) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  function toggleRole(role: string) {
    // The last remaining role cannot be removed.
    if (roles.length === 1 && roles[0] === role) return;
    toggle(roles, setRoles, role);
  }

  // Classes only make sense inside a programme, so they appear once one is picked.
  const classOptions = (options?.classGroups ?? []).filter((c) => programmeCodes.includes(c.programmeCode));

  function toggleProgramme(code: string) {
    const next = programmeCodes.includes(code)
      ? programmeCodes.filter((x) => x !== code)
      : [...programmeCodes, code];
    setProgrammeCodes(next);
    // A class left selected from a programme that was just removed would
    // silently narrow the audience to nobody.
    const allowed = new Set(
      (options?.classGroups ?? []).filter((c) => next.includes(c.programmeCode)).map((c) => c.id),
    );
    setClassGroupIds((ids) => ids.filter((id) => allowed.has(id)));
  }

  // The preview only counts if it was taken for exactly this audience.
  const preview = counted && counted.key === audienceKey ? counted : null;
  const counting = !preview && !previewError;
  const narrowed = programmeCodes.length > 0 || studyYears.length > 0 || classGroupIds.length > 0;
  const nonStudentRoles = roles.filter((r) => r !== "STUDENT");
  const studentsOnly = roles.length === 1 && roles[0] === "STUDENT";
  const reach = preview?.total.reachable ?? 0;

  function describeAudience() {
    const parts = [roles.map((r) => ROLE_LABEL[r] ?? r).join(" + ")];
    if (programmeCodes.length) parts.push(`programme ${programmeCodes.join(", ")}`);
    if (studyYears.length) parts.push(`year ${studyYears.join(", ")}`);
    if (classGroupIds.length) parts.push(`${classGroupIds.length} class${classGroupIds.length === 1 ? "" : "es"}`);
    return parts.join(" · ");
  }

  async function send() {
    if (!preview || reach === 0) return;
    const breakdown = preview.byRole.length
      ? `\nBy role: ${preview.byRole.map((b) => `${ROLE_LABEL[b.role] ?? b.role} ${b.reachable}`).join(", ")}`
      : "";
    const who = narrowed || !studentsOnly ? describeAudience() : "EVERY student with notifications on";
    if (
      !window.confirm(
        `Send "${title.trim()}" to ${who}?\n\n${reach} ${reach === 1 ? "person" : "people"} on ${preview.total.devices} device${
          preview.total.devices === 1 ? "" : "s"
        } will be notified.${breakdown}\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await adminFetch<{
        accepted: number;
        failed?: number;
        userCount: number;
        errors?: string[];
      }>("/api/admin/push", {
        method: "POST",
        body: { title: title.trim(), body: body.trim(), route: route || null, audience, confirm: true },
      });
      const failed = data.failed ?? 0;
      setResult({
        text:
          `Sent to ${data.accepted} device${data.accepted === 1 ? "" : "s"} across ${data.userCount} ${
            data.userCount === 1 ? "person" : "people"
          }` + (failed ? ` · ${failed} failed${data.errors?.length ? ` (${data.errors[0]})` : ""}` : ""),
        tone: data.accepted === 0 ? "fail" : failed > 0 ? "warn" : "ok",
      });
      setTitle("");
      setBody("");
      void load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !busy && Boolean(preview) && reach > 0;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-5">
        <Card className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-800">Message</h2>
          <Field label="Title" required hint="Shown in bold on the lock screen">
            <Input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New rewards just dropped"
            />
            <Counter value={title} max={TITLE_MAX} />
          </Field>
          <Field label="Message" required>
            <Textarea
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Doors at 12:00, Parco delle Memorie Industriali. Free entry."
            />
            <Counter value={body} max={BODY_MAX} />
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
            <p className="text-xs text-gray-500">
              Pick at least one role. Programme, year and class narrow it further; nothing selected in those rows
              means no restriction on them.
            </p>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Role</div>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <Chip key={r.value} active={roles.includes(r.value)} onClick={() => toggleRole(r.value)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          {options && options.programmes.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Programme</div>
              <div className="flex flex-wrap gap-2">
                {options.programmes.map((p) => (
                  <Chip
                    key={p.code}
                    active={programmeCodes.includes(p.code)}
                    onClick={() => toggleProgramme(p.code)}
                  >
                    {p.code} <span className="opacity-60">({p.count})</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {options && options.studyYears.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Year</div>
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

          {classOptions.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Class</div>
              <div className="flex flex-wrap gap-2">
                {classOptions.map((c) => (
                  <Chip
                    key={c.id}
                    active={classGroupIds.includes(c.id)}
                    onClick={() => toggle(classGroupIds, setClassGroupIds, c.id)}
                  >
                    {c.programmeCode} · {c.code} <span className="opacity-60">({c.count})</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {loadError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {loadError}{" "}
              <button type="button" onClick={() => void load()} className="font-medium underline">
                Try again
              </button>
            </p>
          )}
        </Card>
      </div>

      <div className="flex w-full flex-col gap-5 lg:w-80">
        <Card className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-800">Reach</h2>
          {preview ? (
            <>
              <div>
                <div className="text-3xl font-bold text-astra-primary">{reach}</div>
                <div className="text-xs text-gray-500">
                  will be notified, on {preview.total.devices} device
                  {preview.total.devices === 1 ? "" : "s"}
                </div>
              </div>
              {preview.byRole.length > 0 && (
                <ul className="text-xs text-gray-600">
                  {preview.byRole.map((b) => (
                    <li key={b.role} className="flex justify-between">
                      <span>{ROLE_LABEL[b.role] ?? b.role}</span>
                      <span className="font-medium">{b.reachable}</span>
                    </li>
                  ))}
                </ul>
              )}
              {/* The gap between matched and reachable is people who never
                  turned notifications on. Saying so avoids "why only 118?" */}
              {preview.total.users > reach && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  {preview.total.users} match these filters, but {preview.total.users - reach} have no device registered.
                </p>
              )}
              {reach === 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nobody with these filters can be notified, so there is nothing to send.
                </p>
              )}
            </>
          ) : previewError ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {previewError} Change a filter to try again.
            </p>
          ) : (
            <p role="status" className="text-sm text-gray-500">
              Counting…
            </p>
          )}
          {nonStudentRoles.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This also goes to {nonStudentRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ").toLowerCase()}, not only
              students.
            </p>
          )}
          {studentsOnly && !narrowed && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No filters: this goes to every student with notifications on.
            </p>
          )}
          <p className="text-[11px] text-gray-500">{totalDevices} devices registered in total.</p>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {result && (
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-sm ${
                result.tone === "ok"
                  ? "bg-green-50 text-green-800"
                  : result.tone === "warn"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-red-50 text-red-700"
              }`}
            >
              {result.tone === "fail" ? "Nothing was delivered. " : result.tone === "warn" ? "Partly delivered. " : ""}
              {result.text}
            </p>
          )}

          <Button onClick={send} disabled={!canSend} block>
            {busy ? "Sending…" : counting ? "Counting…" : "Send notification"}
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-800">Recently sent</h2>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-500">{loadError ? "Couldn't load recent sends." : "Nothing sent yet."}</p>
          ) : (
            recent.map((c) => (
              <div key={c.id} className="border-t border-gray-100 pt-2 first:border-0 first:pt-0">
                <div className="break-words text-sm font-medium text-gray-800">{c.title}</div>
                <div className="break-words text-xs text-gray-500">{c.body}</div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {romeDateTime(c.createdAt)} · {c.userCount} people
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
