"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentLink, NewsItem } from "@astra/shared";
import { LinksEditor, linkProblems } from "../_components/links-editor";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Counter, Field, Input, Textarea, Toggle } from "@/app/_ui/field";
import { ImageInput } from "../_components/image-input";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { useDirtyGuard } from "../_lib/use-dirty-guard";

const EXCERPT_MAX = 240;

/**
 * `canPush` is decided on the server (the signed-in account has the Notifications
 * page); without it the push toggle is not shown and the API refuses it anyway.
 */
export function NewsForm({ id, initial, canPush = false }: { id?: string; initial?: NewsItem; canPush?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [links, setLinks] = useState<ContentLink[]>(initial?.links ?? []);
  const [notify, setNotify] = useState(false); // per-save action, not stored
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const guard = useDirtyGuard({ title, excerpt, body, imageUrl, published, pinned, links });

  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title");
  if (!body.trim()) problems.push("Write the body");
  if (notify && !published) problems.push("Turn on Published to send a notification (or turn the notification off)");
  problems.push(...linkProblems(links));

  async function save() {
    if (problems.length) return;
    setLoading(true);
    setError(null);
    try {
      const sendPush = canPush && notify && published;
      if (sendPush) {
        // Say exactly who is about to be interrupted before anything is saved.
        const count = await adminFetch<{ preview?: { reachable: number; devices: number } }>("/api/admin/push", {
          method: "POST",
          body: { title: "preview", body: "preview", audience: { roles: ["STUDENT"] }, confirm: false },
        });
        const p = count.preview;
        const reach = p
          ? `${p.reachable} student${p.reachable === 1 ? "" : "s"} on ${p.devices} device${p.devices === 1 ? "" : "s"}`
          : "every student with notifications on";
        const again = initial?.published ? "\n\nThis post is already published, so they get a second notification." : "";
        if (
          !confirm(
            `Save and notify ${reach}?\n\nOnly students are notified (not partners or staff). A notification cannot be recalled.${again}`,
          )
        ) {
          return;
        }
      }
      const payload = {
        title: title.trim(),
        excerpt: excerpt.trim() || null,
        body,
        imageUrl,
        published,
        pinned,
        links,
        ...(sendPush ? { notify: true } : {}),
      };
      if (id) await adminFetch(`/api/admin/news/${id}`, { method: "PATCH", body: payload });
      else await adminFetch("/api/admin/news", { method: "POST", body: payload });
      guard.release();
      router.push("/dashboard/news");
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
      await adminFetch(`/api/admin/news/${id}`, { method: "DELETE" });
      guard.release();
      router.push("/dashboard/news");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <Field label="Title" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Freshers' week is here" />
      </Field>
      <Field label="Excerpt" hint="Short summary shown in the feed (optional). Also the text of the push notification.">
        <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={EXCERPT_MAX} />
        <Counter value={excerpt} max={EXCERPT_MAX} />
      </Field>
      <Field label="Body" required>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the announcement…" />
      </Field>
      <Field label="Cover image" composite>
        <ImageInput
          value={imageUrl}
          onChange={setImageUrl}
          onBusy={setUploading}
          hint="Recommended: 1200 × 600 px (2:1 landscape)"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Published" hint="Visible in the app" checked={published} onChange={setPublished} />
        <Toggle
          label="Show first"
          hint="Appears first in the app news carousel"
          checked={pinned}
          onChange={setPinned}
        />
      </div>
      {canPush && (
        <Toggle
          label="Send push notification"
          hint={
            initial?.published
              ? "Students only. Already published: saving with this on sends it again."
              : "Students only (not partners or staff). You will see how many before it goes out."
          }
          checked={notify}
          onChange={setNotify}
        />
      )}

      <LinksEditor value={links} onChange={setLinks} />

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
          <button
            type="button"
            onClick={remove}
            disabled={loading}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => guard.confirmLeave() && router.push("/dashboard/news")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || uploading || problems.length > 0}>
            {loading ? "Saving…" : id ? "Save changes" : published ? "Publish" : "Save draft"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
