"use client";

import { useEffect, useState } from "react";
import {
  ASTRAWORLD_DEFAULT,
  astraWorldContent,
  type AstraWorldContent,
  type AstraWorldSlot,
} from "@astra/shared";
import { Card } from "@/app/_ui/card";
import { Button } from "@/app/_ui/button";
import { Field, Input, Textarea, Toggle } from "@/app/_ui/field";

type Bilingual = { en: string; it: string };

/**
 * Both languages side by side, always.
 *
 * The app is bilingual and picks per reader, so an editor who fills in only
 * Italian would blank the screen for anyone reading in English. Showing the two
 * together makes the omission visible while typing rather than after shipping.
 */
function BiField({
  label,
  value,
  onChange,
  multiline = false,
  hint,
}: {
  label: string;
  value: Bilingual;
  onChange: (v: Bilingual) => void;
  multiline?: boolean;
  hint?: string;
}) {
  const Control = multiline ? Textarea : Input;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} (EN)`} hint={hint}>
        <Control value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
      </Field>
      <Field label={`${label} (IT)`}>
        <Control value={value.it} onChange={(e) => onChange({ ...value, it: e.target.value })} />
      </Field>
    </div>
  );
}

function SlotEditor({
  slot,
  onChange,
  onRemove,
}: {
  slot: AstraWorldSlot;
  onChange: (s: AstraWorldSlot) => void;
  onRemove: () => void;
}) {
  const panel = slot.panel ?? null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3">
      <div className="flex items-end gap-3">
        <div className="w-28">
          <Field label="Time" required>
            <Input
              value={slot.time}
              placeholder="15:00"
              onChange={(e) => onChange({ ...slot, time: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={slot.ours}
            onChange={(e) => onChange({ ...slot, ours: e.target.checked })}
          />
          Highlight as ours
        </label>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          className="pb-2.5 text-xs font-medium text-red-600 hover:text-red-700"
        >
          Remove
        </button>
      </div>

      <BiField
        label="What it is"
        value={slot.label}
        onChange={(label) => onChange({ ...slot, label })}
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={panel !== null}
          onChange={(e) =>
            onChange({
              ...slot,
              panel: e.target.checked
                ? {
                    org: "",
                    window: slot.time,
                    title: { en: "", it: "" },
                    hook: { en: "", it: "" },
                    speakers: [],
                  }
                : null,
            })
          }
        />
        This is a panel (tappable, with details)
      </label>

      {panel && (
        <div className="flex flex-col gap-3 border-l-2 border-gray-100 pl-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organisation" required>
              <Input
                value={panel.org}
                placeholder="Start Lab · UniCredit"
                onChange={(e) => onChange({ ...slot, panel: { ...panel, org: e.target.value } })}
              />
            </Field>
            <Field label="Time window" required>
              <Input
                value={panel.window}
                placeholder="15:00 – 15:50"
                onChange={(e) => onChange({ ...slot, panel: { ...panel, window: e.target.value } })}
              />
            </Field>
          </div>
          <BiField
            label="Panel title"
            value={panel.title}
            onChange={(title) => onChange({ ...slot, panel: { ...panel, title } })}
          />
          <BiField
            label="Pitch"
            multiline
            value={panel.hook}
            onChange={(hook) => onChange({ ...slot, panel: { ...panel, hook } })}
          />
          <Field label="Speakers" hint="One per line">
            <Textarea
              value={panel.speakers.join("\n")}
              onChange={(e) =>
                onChange({
                  ...slot,
                  panel: {
                    ...panel,
                    speakers: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  },
                })
              }
            />
          </Field>
        </div>
      )}
    </div>
  );
}

export function AstraWorldEditor() {
  const [content, setContent] = useState<AstraWorldContent>(ASTRAWORLD_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [stored, setStored] = useState(false);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: string | null }>({
    updatedAt: null,
    updatedBy: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/content/astraworld", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (data?.data) {
        const parsed = astraWorldContent.safeParse(data.data);
        // A stored row that no longer matches the schema (an older shape, say)
        // should not leave the editor empty — start from the default instead.
        if (parsed.success) setContent(parsed.data);
        setStored(true);
      }
      setMeta({ updatedAt: data?.updatedAt ?? null, updatedBy: data?.updatedBy ?? null });
      setLoaded(true);
    })();
  }, []);

  function set<K extends keyof AstraWorldContent>(key: K, value: AstraWorldContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setDone(null);
    // Validate here too, so a mistake is reported next to the field rather than
    // as a generic API error.
    const parsed = astraWorldContent.safeParse(content);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      setError(i ? `${i.path.join(".")}: ${i.message}` : "Something is not filled in correctly.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/content/astraworld", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
      setStored(true);
      setMeta({ updatedAt: data.updatedAt, updatedBy: "you" });
      setDone("Saved. The app picks this up within a minute.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function revert() {
    if (!window.confirm("Discard the saved version and go back to what the app ships with?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/content/astraworld", { method: "DELETE", credentials: "include" });
      setContent(ASTRAWORLD_DEFAULT);
      setStored(false);
      setMeta({ updatedAt: null, updatedBy: null });
      setDone("Reverted to the version built into the app.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              {stored ? "Edited version is live" : "Showing the version built into the app"}
            </h2>
            <p className="text-xs text-gray-400">
              {meta.updatedAt
                ? `Last saved ${new Date(meta.updatedAt).toLocaleString("en-GB")}${
                    meta.updatedBy ? ` by ${meta.updatedBy}` : ""
                  }`
                : "Nothing saved yet — the app is using its built-in copy."}
            </p>
          </div>
          <Toggle
            label="Show the tab"
            hint="Turn off to hide the event"
            checked={content.visible}
            onChange={(v) => set("visible", v)}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-800">Header</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date badge" hint="Short, e.g. 04.09">
            <Input value={content.dateShort} onChange={(e) => set("dateShort", e.target.value)} />
          </Field>
          <Field label="Hours">
            <Input value={content.hours} onChange={(e) => set("hours", e.target.value)} />
          </Field>
          <Field label="Venue">
            <Input value={content.venue} onChange={(e) => set("venue", e.target.value)} />
          </Field>
        </div>
        <BiField label="Full date" value={content.date} onChange={(v) => set("date", v)} />
        <BiField label="Entry" value={content.entry} onChange={(v) => set("entry", v)} />
        <BiField label="Tagline" value={content.tagline} onChange={(v) => set("tagline", v)} />
        <BiField label="Intro" multiline value={content.intro} onChange={(v) => set("intro", v)} />
        <Field label="Maps search" hint="What the Open in Maps button looks up">
          <Input value={content.mapsQuery} onChange={(e) => set("mapsQuery", e.target.value)} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <BiField label="Day section title" value={content.dayTitle} onChange={(v) => set("dayTitle", v)} />
        {content.dayParagraphs.map((p, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  set("dayParagraphs", content.dayParagraphs.filter((_, j) => j !== i))
                }
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <BiField
              label={`Paragraph ${i + 1}`}
              multiline
              value={p}
              onChange={(v) =>
                set("dayParagraphs", content.dayParagraphs.map((x, j) => (j === i ? v : x)))
              }
            />
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() => set("dayParagraphs", [...content.dayParagraphs, { en: "", it: "" }])}
          >
            + Paragraph
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <BiField
          label="Programme title"
          value={content.programmeTitle}
          onChange={(v) => set("programmeTitle", v)}
        />
        {content.slots.map((s, i) => (
          <SlotEditor
            key={i}
            slot={s}
            onChange={(next) => set("slots", content.slots.map((x, j) => (j === i ? next : x)))}
            onRemove={() => set("slots", content.slots.filter((_, j) => j !== i))}
          />
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              set("slots", [
                ...content.slots,
                { time: "", label: { en: "", it: "" }, ours: false, panel: null },
              ])
            }
          >
            + Slot
          </Button>
        </div>
        <BiField
          label="Note under the programme"
          value={content.programmeNote}
          onChange={(v) => set("programmeNote", v)}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <BiField label="Village title" value={content.villageTitle} onChange={(v) => set("villageTitle", v)} />
        <BiField label="Village text" multiline value={content.villageBody} onChange={(v) => set("villageBody", v)} />
        <BiField
          label="Communities title"
          value={content.communitiesTitle}
          onChange={(v) => set("communitiesTitle", v)}
        />
        <BiField
          label="Communities text"
          multiline
          value={content.communitiesBody}
          onChange={(v) => set("communitiesBody", v)}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <BiField label="Partners title" value={content.partnersTitle} onChange={(v) => set("partnersTitle", v)} />
        {content.partnerGroups.map((g, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => set("partnerGroups", content.partnerGroups.filter((_, j) => j !== i))}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <BiField
              label="Tier"
              value={g.label}
              onChange={(label) =>
                set("partnerGroups", content.partnerGroups.map((x, j) => (j === i ? { ...x, label } : x)))
              }
            />
            <Field label="Names" hint="One per line">
              <Textarea
                value={g.names.join("\n")}
                onChange={(e) =>
                  set(
                    "partnerGroups",
                    content.partnerGroups.map((x, j) =>
                      j === i
                        ? { ...x, names: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }
                        : x,
                    ),
                  )
                }
              />
            </Field>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              set("partnerGroups", [...content.partnerGroups, { label: { en: "", it: "" }, names: [] }])
            }
          >
            + Tier
          </Button>
        </div>
        <BiField label="Note" value={content.partnersNote} onChange={(v) => set("partnersNote", v)} />
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex items-center justify-between">
        {stored ? (
          <button
            onClick={revert}
            disabled={busy}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
          >
            Revert to built-in version
          </button>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
