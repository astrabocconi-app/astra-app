"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentLink, HomeBubbleContent, MapSponsorsContent, MobilitySponsor } from "@astra/shared";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Textarea, Toggle, Counter } from "@/app/_ui/field";
import { PlusIcon } from "@/app/_ui/icons";
import { ImageInput } from "../_components/image-input";
import { VideoInput } from "../_components/video-input";
import { LinksEditor, linkProblems } from "../_components/links-editor";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { useDirtyGuard } from "../_lib/use-dirty-guard";

// Editors for the two AppContent documents the app reads live: the round button
// on Home and the "get there fast" sponsors on the map. Images and text are
// kept as plain strings while editing ("" = none); the server's schema turns
// blanks into nulls on save.

const s = (v: string | null | undefined) => v ?? "";

/** Several image pickers can upload at once; Save waits for all of them. */
function useBusy() {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  return {
    any: Object.values(busy).some(Boolean),
    set: (key: string) => (b: boolean) =>
      setBusy((prev) => (prev[key] === b ? prev : { ...prev, [key]: b })),
  };
}

function SaveBar({
  saving,
  disabled,
  onSave,
  savedAt,
  error,
  problems,
}: {
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
  savedAt: string | null;
  error: string | null;
  problems: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {problems.length > 0 && (
        <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-xs text-amber-800">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {savedAt && <span className="text-xs text-gray-500">Saved {savedAt}. The app picks it up within a minute.</span>}
        <Button onClick={onSave} disabled={disabled || saving || problems.length > 0}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

async function put(key: string, data: unknown) {
  return adminFetch(`/api/admin/content/${key}`, { method: "PUT", body: data });
}

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ── Home bubble ─────────────────────────────────────────────────────────────

export function HomeBubbleForm({ initial }: { initial: HomeBubbleContent }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [logoUrl, setLogoUrl] = useState(s(initial.logoUrl));
  const [title, setTitle] = useState(s(initial.title));
  const [body, setBody] = useState(s(initial.body));
  const [imageUrl, setImageUrl] = useState(s(initial.imageUrl));
  const [links, setLinks] = useState<ContentLink[]>(initial.links);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const busy = useBusy();
  const value = { enabled, logoUrl, title, body, imageUrl, links };
  const guard = useDirtyGuard(value);

  const problems = [...linkProblems(links)];
  if (enabled && !logoUrl) problems.push("Add the logo shown in the round button (or switch the bubble off)");
  if (enabled && !title.trim() && !body.trim() && !imageUrl) problems.push("Give the card a title, some text or a picture");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await put("home-bubble", value);
      guard.release();
      setSavedAt(now());
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Home bubble</h2>
        <p className="text-xs text-gray-500">
          A round logo at the bottom right of the Home screen. Tapping it opens a card with a picture, text and buttons.
        </p>
      </div>

      <Toggle label="Show on Home" hint="Off hides the bubble for everyone" checked={enabled} onChange={setEnabled} />

      <Field label="Logo (round button)" composite>
        <ImageInput value={logoUrl} onChange={setLogoUrl} onBusy={busy.set("logo")} hint="Square, at least 300 × 300 px. It is cut to a circle." />
      </Field>
      <Field label="Picture (top of the card)" composite>
        <ImageInput value={imageUrl} onChange={setImageUrl} onBusy={busy.set("image")} hint="Landscape works best, e.g. 1200 × 700 px" />
      </Field>
      <Field label="Title">
        <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New: ASTRA x Dott" />
        <Counter value={title} max={80} />
      </Field>
      <Field label="Text">
        <Textarea value={body} maxLength={1500} onChange={(e) => setBody(e.target.value)} placeholder="What students should know." />
        <Counter value={body} max={1500} />
      </Field>
      <LinksEditor value={links} onChange={setLinks} />

      <SaveBar saving={saving} disabled={busy.any} onSave={save} savedAt={savedAt} error={error} problems={problems} />
    </Card>
  );
}

// ── Map sponsors ────────────────────────────────────────────────────────────

type SponsorDraft = {
  id: string;
  name: string;
  logoUrl: string;
  tagline: string;
  title: string;
  body: string;
  imageUrl: string;
  links: ContentLink[];
  redeemLabel: string;
  redeemVideoUrl: string;
  redeemVideoPosterUrl: string;
  redeemSlides: { imageUrl: string; caption: string }[];
};

function toDraft(x: MobilitySponsor): SponsorDraft {
  return {
    id: x.id,
    name: x.name,
    logoUrl: s(x.logoUrl),
    tagline: s(x.tagline),
    title: s(x.title),
    body: s(x.body),
    imageUrl: s(x.imageUrl),
    links: x.links,
    redeemLabel: s(x.redeemLabel),
    redeemVideoUrl: s(x.redeemVideoUrl),
    redeemVideoPosterUrl: s(x.redeemVideoPosterUrl),
    redeemSlides: x.redeemSlides.map((sl) => ({ imageUrl: s(sl.imageUrl), caption: s(sl.caption) })),
  };
}

const slug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function emptySponsor(n: number): SponsorDraft {
  return {
    id: `sponsor-${n}`,
    name: "",
    logoUrl: "",
    tagline: "",
    title: "",
    body: "",
    imageUrl: "",
    links: [],
    redeemLabel: "",
    redeemVideoUrl: "",
    redeemVideoPosterUrl: "",
    redeemSlides: [],
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function MapSponsorsForm({ initial }: { initial: MapSponsorsContent }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [bubbleText, setBubbleText] = useState(initial.bubbleText);
  const [title, setTitle] = useState(s(initial.title));
  const [subtitle, setSubtitle] = useState(s(initial.subtitle));
  const [sponsors, setSponsors] = useState<SponsorDraft[]>(initial.sponsors.map(toDraft));
  const [open, setOpen] = useState<number | null>(initial.sponsors.length ? null : 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const busy = useBusy();
  const value = { enabled, bubbleText, title, subtitle, sponsors };
  const guard = useDirtyGuard(value);

  const problems: string[] = [];
  if (!bubbleText.trim()) problems.push("The bubble needs its text");
  if (enabled && sponsors.length === 0) problems.push("Add at least one sponsor, or switch the bubble off");
  const ids = new Set<string>();
  sponsors.forEach((sp, i) => {
    const n = sp.name.trim() || `Sponsor ${i + 1}`;
    if (!sp.name.trim()) problems.push(`Sponsor ${i + 1} needs a name`);
    if (!sp.logoUrl) problems.push(`${n} needs a logo`);
    if (!/^[a-z0-9-]+$/.test(sp.id)) problems.push(`${n}: the page id may only use lowercase letters, numbers and dashes`);
    if (ids.has(sp.id)) problems.push(`${n}: another sponsor already uses the id "${sp.id}"`);
    ids.add(sp.id);
    sp.redeemSlides.forEach((sl, j) => {
      if (!sl.imageUrl) problems.push(`${n}: step ${j + 1} of "How to redeem" needs a picture`);
    });
    for (const p of linkProblems(sp.links)) problems.push(`${n}: ${p}`);
  });

  function patch(i: number, p: Partial<SponsorDraft>) {
    setSponsors((prev) => prev.map((sp, j) => (j === i ? { ...sp, ...p } : sp)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await put("map-sponsors", value);
      guard.release();
      setSavedAt(now());
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Map: “get there fast”</h2>
        <p className="text-xs text-gray-500">
          A speech bubble at the bottom right of the Discounts map. Tapping it lists these sponsors with their logos;
          each opens its own page with a “How to redeem” video or pictures.
        </p>
      </div>

      <Toggle label="Show on the map" hint="Off hides the bubble for everyone" checked={enabled} onChange={setEnabled} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bubble text" required>
          <Input value={bubbleText} maxLength={40} onChange={(e) => setBubbleText(e.target.value)} placeholder="Wanna get there fast?" />
        </Field>
        <Field label="Chooser title" hint="Heading of the sheet that opens. Empty: the bubble text.">
          <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Pick a ride" />
        </Field>
      </div>
      <Field label="Chooser subtitle">
        <Input value={subtitle} maxLength={200} onChange={(e) => setSubtitle(e.target.value)} placeholder="Student discounts with our mobility partners" />
      </Field>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-800">Sponsors</h3>
        {sponsors.length === 0 && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">No sponsors yet.</p>}

        {sponsors.map((sp, i) => {
          const expanded = open === i;
          const logo = sp.logoUrl.startsWith("/") && typeof window !== "undefined" ? window.location.origin + sp.logoUrl : sp.logoUrl;
          return (
            <div key={i} className="rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 text-[10px] text-gray-400">
                    {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : "Logo"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{sp.name || `Sponsor ${i + 1}`}</span>
                    <span className="block truncate text-xs text-gray-500">{sp.tagline || "No tagline"}</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => setSponsors((p) => move(p, i, i - 1))} className="h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" disabled={i === sponsors.length - 1} onClick={() => setSponsors((p) => move(p, i, i + 1))} className="h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                    ↓
                  </button>
                  <button type="button" onClick={() => setOpen(expanded ? null : i)} className="rounded-lg px-2 py-1.5 text-xs font-medium text-astra-primary hover:bg-gray-100">
                    {expanded ? "Close" : "Edit"}
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="flex flex-col gap-4 border-t border-gray-100 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" required>
                      <Input
                        value={sp.name}
                        maxLength={40}
                        onChange={(e) => {
                          const name = e.target.value;
                          // Follow the name until the id has been edited by hand.
                          const auto = sp.id === slug(sp.name) || /^sponsor-\d+$/.test(sp.id);
                          patch(i, { name, ...(auto && slug(name) ? { id: slug(name) } : {}) });
                        }}
                        placeholder="e.g. Dott"
                      />
                    </Field>
                    <Field label="Page id" hint="Lowercase, no spaces. Changing it is harmless.">
                      <Input value={sp.id} maxLength={40} onChange={(e) => patch(i, { id: e.target.value.toLowerCase() })} />
                    </Field>
                  </div>
                  <Field label="Logo" composite>
                    <ImageInput value={sp.logoUrl} onChange={(v) => patch(i, { logoUrl: v })} onBusy={busy.set(`${i}-logo`)} hint="Square, at least 300 × 300 px" />
                  </Field>
                  <Field label="Tagline" hint="One line under the logo in the chooser.">
                    <Input value={sp.tagline} maxLength={80} onChange={(e) => patch(i, { tagline: e.target.value })} placeholder="e.g. 20% off every ride" />
                  </Field>

                  <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Sponsor page</h4>
                  <Field label="Picture" composite>
                    <ImageInput value={sp.imageUrl} onChange={(v) => patch(i, { imageUrl: v })} onBusy={busy.set(`${i}-image`)} hint="Landscape, e.g. 1200 × 700 px" />
                  </Field>
                  <Field label="Title">
                    <Input value={sp.title} maxLength={120} onChange={(e) => patch(i, { title: e.target.value })} placeholder="e.g. Ride Dott with your ASTRA discount" />
                  </Field>
                  <Field label="Text">
                    <Textarea value={sp.body} maxLength={2000} onChange={(e) => patch(i, { body: e.target.value })} placeholder="The offer, the code, the conditions." />
                    <Counter value={sp.body} max={2000} />
                  </Field>
                  <LinksEditor value={sp.links} onChange={(links) => patch(i, { links })} />

                  <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">How to redeem</h4>
                  <Field label="Button text" hint="Empty: “How to redeem”. The button shows when there is a video or at least one picture.">
                    <Input value={sp.redeemLabel} maxLength={40} onChange={(e) => patch(i, { redeemLabel: e.target.value })} placeholder="How to redeem" />
                  </Field>
                  <Field label="Video" composite>
                    <VideoInput
                      value={sp.redeemVideoUrl}
                      onChange={(video, poster) => patch(i, { redeemVideoUrl: video, redeemVideoPosterUrl: poster ?? "" })}
                      onBusy={busy.set(`${i}-video`)}
                    />
                  </Field>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-medium text-gray-700">Pictures (a swipeable walkthrough)</span>
                    {sp.redeemSlides.map((sl, j) => (
                      <div key={j} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step {j + 1}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" aria-label="Move step up" disabled={j === 0} onClick={() => patch(i, { redeemSlides: move(sp.redeemSlides, j, j - 1) })} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30">↑</button>
                            <button type="button" aria-label="Move step down" disabled={j === sp.redeemSlides.length - 1} onClick={() => patch(i, { redeemSlides: move(sp.redeemSlides, j, j + 1) })} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30">↓</button>
                            <button type="button" onClick={() => patch(i, { redeemSlides: sp.redeemSlides.filter((_, k) => k !== j) })} className="px-2 text-xs font-medium text-red-600 hover:text-red-700">Remove</button>
                          </div>
                        </div>
                        <ImageInput
                          value={sl.imageUrl}
                          onChange={(v) => patch(i, { redeemSlides: sp.redeemSlides.map((x, k) => (k === j ? { ...x, imageUrl: v } : x)) })}
                          onBusy={busy.set(`${i}-slide-${j}`)}
                          hint="Phone screenshots work well (portrait)"
                        />
                        <Input
                          value={sl.caption}
                          maxLength={200}
                          aria-label={`Caption for step ${j + 1}`}
                          onChange={(e) => patch(i, { redeemSlides: sp.redeemSlides.map((x, k) => (k === j ? { ...x, caption: e.target.value } : x)) })}
                          placeholder="Caption, e.g. Open the Dott app and tap Wallet"
                        />
                      </div>
                    ))}
                    {sp.redeemSlides.length < 12 && (
                      <Button variant="secondary" onClick={() => patch(i, { redeemSlides: [...sp.redeemSlides, { imageUrl: "", caption: "" }] })}>
                        <PlusIcon size={16} /> Add a picture
                      </Button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Remove ${sp.name || "this sponsor"}?`)) return;
                      setSponsors((p) => p.filter((_, j) => j !== i));
                      setOpen(null);
                    }}
                    className="self-start pt-2 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Remove sponsor
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {sponsors.length < 6 && (
          <Button
            variant="secondary"
            onClick={() => {
              setSponsors((p) => [...p, emptySponsor(p.length + 1)]);
              setOpen(sponsors.length);
            }}
          >
            <PlusIcon size={18} /> Add a sponsor
          </Button>
        )}
      </div>

      <SaveBar saving={saving} disabled={busy.any} onSave={save} savedAt={savedAt} error={error} problems={problems} />
    </Card>
  );
}
