"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  isoToRomeInput,
  romeInputToIso,
  POLARE_MAX_CAROUSEL,
  type PolareMedia,
  type PolarePost,
} from "@astra/shared";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Counter, Field, Input, Select, Textarea, Toggle } from "@/app/_ui/field";
import { ImageInput } from "../_components/image-input";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { useDirtyGuard } from "../_lib/use-dirty-guard";

const CAPTION_MAX = 2200;
const IMAGE_MAX_BYTES = 4 * 1024 * 1024; // /api/admin/upload limit
const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // the Blob token's limit
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type Kind = PolarePost["kind"];

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "IMAGE", label: "Photo", hint: "One image." },
  { value: "CAROUSEL", label: "Carousel", hint: `2 to ${POLARE_MAX_CAROUSEL} photos or videos, swiped in order.` },
  { value: "REEL", label: "Reel", hint: "One video, ideally vertical (9:16)." },
];

const abs = (u: string | null) => (u && u.startsWith("/") ? window.location.origin + u : (u ?? ""));

/** Pixel size of a picked image or video, so the app can reserve the right space. Null if it can't be read. */
function readSize(file: File, type: "image" | "video"): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (v: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    if (type === "image") {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done(null);
      img.src = url;
    } else {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done({ width: v.videoWidth, height: v.videoHeight });
      v.onerror = () => done(null);
      v.src = url;
    }
  });
}

/** A JPEG frame from near the start of a video, used as its cover. Null if the browser can't decode it. */
function captureFrame(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = (f: File | null) => {
      URL.revokeObjectURL(url);
      resolve(f);
    };
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onerror = () => done(null);
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      try {
        const scale = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => done(b ? new File([b], "cover.jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.85);
      } catch {
        done(null);
      }
    };
    v.src = url;
  });
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  return (await adminFetch<{ url: string }>("/api/admin/upload", { method: "POST", form: fd })).url;
}

export function PolareForm({ id, initial }: { id?: string; initial?: PolarePost }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "IMAGE");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [media, setMedia] = useState<PolareMedia[]>(initial?.media ?? []);
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  // Milan wall time, whatever timezone this browser is in. Blank = now, when it goes live.
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ? isoToRomeInput(initial.publishedAt) : "");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // what is uploading, for the button and the note
  const [coverBusy, setCoverBusy] = useState(false); // a cover picked by hand is uploading
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const guard = useDirtyGuard({ kind, caption, media, externalUrl, published, pinned, publishedAt });

  const single = kind !== "CAROUSEL";
  const canAddImage = kind === "CAROUSEL" ? media.length < POLARE_MAX_CAROUSEL : kind === "IMAGE" && media.length === 0;
  const canAddVideo = kind === "CAROUSEL" ? media.length < POLARE_MAX_CAROUSEL : kind === "REEL" && media.length === 0;

  const problems: string[] = [];
  if (kind === "IMAGE" && !(media.length === 1 && media[0]?.type === "image")) problems.push("Add one photo");
  if (kind === "REEL" && !(media.length === 1 && media[0]?.type === "video")) problems.push("Add one video");
  if (kind === "CAROUSEL" && media.length < 2) problems.push("A carousel needs at least two photos or videos");
  if (caption.length > CAPTION_MAX) problems.push(`Caption is over ${CAPTION_MAX} characters`);
  if (externalUrl.trim() && !/^https:\/\/\S+$/.test(externalUrl.trim())) problems.push("The Instagram link must start with https://");

  function changeKind(next: Kind) {
    if (next === kind) return;
    // A photo or reel holds one item of its own type; anything else would be thrown away silently.
    const keep = next === "CAROUSEL" ? media : media.filter((m) => m.type === (next === "IMAGE" ? "image" : "video")).slice(0, 1);
    if (keep.length < media.length && !confirm("Switching type removes the media that doesn't fit. Continue?")) return;
    setKind(next);
    setMedia(keep);
    setSlide(0);
  }

  const patchItem = (i: number, p: Partial<PolareMedia>) => setMedia((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) =>
    setMedia((m) => {
      const j = i + d;
      if (j < 0 || j >= m.length) return m;
      const c = [...m];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });

  async function addImages(files: File[]) {
    setError(null);
    const room = kind === "CAROUSEL" ? POLARE_MAX_CAROUSEL - media.length : 1 - media.length;
    const added: PolareMedia[] = [];
    try {
      for (const file of files.slice(0, Math.max(room, 0))) {
        if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use JPEG, PNG, WebP or GIF images.");
        if (file.size > IMAGE_MAX_BYTES) throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB. Photos can be up to 4 MB.`);
        setBusy(`Uploading ${file.name}…`);
        const [url, size] = await Promise.all([uploadImage(file), readSize(file, "image")]);
        added.push({ type: "image", url, posterUrl: null, alt: null, width: size?.width ?? null, height: size?.height ?? null });
      }
    } catch (e) {
      setError(errorMessage(e, "Upload failed."));
    } finally {
      setBusy(null);
      if (added.length) setMedia((m) => [...m, ...added]);
    }
  }

  async function addVideo(file: File) {
    setError(null);
    if (!VIDEO_TYPES.includes(file.type)) return setError("Use an MP4, MOV or WebM video.");
    if (file.size > VIDEO_MAX_BYTES) return setError(`That video is ${(file.size / 1048576).toFixed(0)} MB. The limit is 100 MB.`);
    try {
      setBusy("Uploading video… 0%");
      const [blob, size, frame] = await Promise.all([
        upload(`polare/${file.name.replace(/[^\w.-]+/g, "_")}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/polare/upload",
          multipart: true,
          onUploadProgress: ({ percentage }) => setBusy(`Uploading video… ${Math.round(percentage)}%`),
        }),
        readSize(file, "video"),
        captureFrame(file),
      ]);
      // The cover is a courtesy: if the frame can't be grabbed or stored, the video still works.
      let posterUrl: string | null = null;
      if (frame) {
        setBusy("Saving cover…");
        posterUrl = await uploadImage(frame).catch(() => null);
      }
      setMedia((m) => [...m, { type: "video", url: blob.url, posterUrl, alt: null, width: size?.width ?? null, height: size?.height ?? null }]);
    } catch (e) {
      setError(errorMessage(e, "Video upload failed."));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (problems.length) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        kind,
        caption: caption.trim(),
        media: media.map((m) => ({ ...m, posterUrl: m.posterUrl || null, alt: m.alt?.trim() || null })),
        externalUrl: externalUrl.trim() || null,
        published,
        pinned,
        ...(publishedAt ? { publishedAt: romeInputToIso(publishedAt) } : {}),
      };
      if (id) await adminFetch(`/api/admin/polare/${id}`, { method: "PATCH", body: payload });
      else await adminFetch("/api/admin/polare", { method: "POST", body: payload });
      guard.release();
      router.push("/dashboard/polare");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save."));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this post? This can't be undone.")) return;
    setLoading(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/polare/${id}`, { method: "DELETE" });
      guard.release();
      router.push("/dashboard/polare");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete."));
    } finally {
      setLoading(false);
    }
  }

  const shown = media[Math.min(slide, Math.max(media.length - 1, 0))];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="flex flex-col gap-5">
        <Field label="Type" hint={KINDS.find((k) => k.value === kind)?.hint}>
          <Select value={kind} onChange={(e) => changeKind(e.target.value as Kind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={single ? (kind === "REEL" ? "Video" : "Photo") : "Photos and videos"} composite required>
          <div className="flex flex-col gap-3">
            {media.map((m, i) => (
              <div key={`${m.url}-${i}`} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-[11px] text-gray-500">
                    {m.type === "image" || m.posterUrl ? (
                      <img src={abs(m.type === "image" ? m.url : m.posterUrl)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      "Video"
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {kind === "CAROUSEL" ? `${i + 1}. ` : ""}
                      {m.type === "image" ? "Photo" : "Video"}
                    </span>
                    {m.type === "image" && (
                      <Input
                        aria-label="Description for screen readers"
                        value={m.alt ?? ""}
                        maxLength={300}
                        onChange={(e) => patchItem(i, { alt: e.target.value })}
                        placeholder="Describe the photo (for screen readers, optional)"
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {kind === "CAROUSEL" && (
                      <>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`} className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                          ↑
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === media.length - 1} aria-label={`Move item ${i + 1} down`} className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                          ↓
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50">
                      Remove
                    </button>
                  </div>
                </div>
                {m.type === "video" && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-gray-600">Cover image {m.posterUrl ? "" : "(none)"}</summary>
                    <div className="pt-2">
                      <ImageInput value={m.posterUrl ?? ""} onChange={(v) => patchItem(i, { posterUrl: v || null })} onBusy={setCoverBusy} hint="Shown until the video plays. Taken from the video automatically." />
                    </div>
                  </details>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <input ref={imageRef} type="file" accept={IMAGE_TYPES.join(",")} multiple={kind === "CAROUSEL"} className="hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) void addImages(f); }} />
              <input ref={videoRef} type="file" accept={VIDEO_TYPES.join(",")} className="hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addVideo(f); }} />
              {kind !== "REEL" && (
                <button type="button" onClick={() => imageRef.current?.click()} disabled={!canAddImage || !!busy || coverBusy} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Add {kind === "CAROUSEL" ? "photos" : "photo"}
                </button>
              )}
              {kind !== "IMAGE" && (
                <button type="button" onClick={() => videoRef.current?.click()} disabled={!canAddVideo || !!busy || coverBusy} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Add video
                </button>
              )}
            </div>
            {busy && (
              <p role="status" className="text-xs text-gray-600">
                {busy}
              </p>
            )}
            <p className="text-xs text-gray-500">Photos: JPEG, PNG, WebP or GIF up to 4 MB. Videos: MP4, MOV or WebM up to 100 MB.</p>
          </div>
        </Field>

        <Field label="Caption">
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write the caption…" />
          <Counter value={caption} max={CAPTION_MAX} />
        </Field>

        <Field label="Instagram link" hint="Optional. Opens the original post from the app.">
          <Input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" />
        </Field>

        <Field label="Date (Milan time)" hint="Optional. Leave blank to use the moment it is published; set it to keep an older post in order.">
          <Input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Published" hint="Visible in the app" checked={published} onChange={setPublished} />
          <Toggle label="Show first" hint="Pinned to the top of the feed" checked={pinned} onChange={setPinned} />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {problems.length > 0 && (
          <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-xs text-amber-800">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {id ? (
            <button type="button" onClick={remove} disabled={loading} className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => guard.confirmLeave() && router.push("/dashboard/polare")} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={save} disabled={loading || !!busy || coverBusy || problems.length > 0}>
              {loading ? "Saving…" : id ? "Save changes" : published ? "Publish" : "Save draft"}
            </Button>
          </div>
        </div>
      </Card>

      {/* What the app will show: a rough phone-width preview. */}
      <aside aria-label="Preview" className="lg:sticky lg:top-6 lg:self-start">
        <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-astra-primary text-xs font-semibold text-white">SP</span>
            <span className="text-sm font-semibold text-gray-900">Stella Polare</span>
          </div>
          <div className="relative flex aspect-square items-center justify-center bg-gray-100 text-xs text-gray-500">
            {shown ? (
              <img src={abs(shown.type === "image" ? shown.url : shown.posterUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              "No media yet"
            )}
            {shown?.type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center text-4xl text-white/90 drop-shadow">▶</span>
            )}
            {kind === "CAROUSEL" && media.length > 1 && (
              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                {Math.min(slide, media.length - 1) + 1}/{media.length}
              </span>
            )}
          </div>
          {kind === "CAROUSEL" && media.length > 1 && (
            <div className="flex items-center justify-center gap-2 py-2">
              <button type="button" onClick={() => setSlide((s) => Math.max(0, s - 1))} aria-label="Previous item" className="px-2 text-gray-500">
                ‹
              </button>
              {media.map((_, i) => (
                <span key={i} aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${i === Math.min(slide, media.length - 1) ? "bg-astra-primary" : "bg-gray-300"}`} />
              ))}
              <button type="button" onClick={() => setSlide((s) => Math.min(media.length - 1, s + 1))} aria-label="Next item" className="px-2 text-gray-500">
                ›
              </button>
            </div>
          )}
          <p className="whitespace-pre-wrap break-words px-3 pb-4 pt-2 text-sm text-gray-800">
            {caption || <span className="text-gray-400">Your caption appears here.</span>}
          </p>
        </div>
      </aside>
    </div>
  );
}
