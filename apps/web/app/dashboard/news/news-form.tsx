"use client";

import { useState } from "react";
import type { ContentLink } from "@astra/shared";
import { LinksEditor } from "../_components/links-editor";
import { useRouter } from "next/navigation";
import type { NewsItem } from "@astra/shared";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Textarea, Toggle } from "@/app/_ui/field";
import { ImageInput } from "../_components/image-input";

async function send(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data;
}

export function NewsForm({ id, initial }: { id?: string; initial?: NewsItem }) {
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

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const payload = { title, excerpt, body, imageUrl, published, pinned, links, notify };
      if (id) await send(`/api/admin/news/${id}`, "PATCH", payload);
      else await send("/api/admin/news", "POST", payload);
      router.push("/dashboard/news");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this post? This can't be undone.")) return;
    setLoading(true);
    try {
      await send(`/api/admin/news/${id}`, "DELETE");
      router.push("/dashboard/news");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <Field label="Title" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Freshers' week is here" />
      </Field>
      <Field label="Excerpt" hint="Short summary shown in the feed (optional).">
        <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={240} />
      </Field>
      <Field label="Body" required>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the announcement…" />
      </Field>
      <Field label="Cover image">
        <ImageInput
          value={imageUrl}
          onChange={setImageUrl}
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
      <Toggle
        label="Send push notification"
        hint="Alerts every student's phone when you save this as published"
        checked={notify}
        onChange={setNotify}
      />

      <LinksEditor value={links} onChange={setLinks} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        {id ? (
          <button onClick={remove} disabled={loading} className="text-sm font-medium text-red-600 hover:text-red-700">
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/dashboard/news")} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || !title || !body}>
            {loading ? "Saving…" : id ? "Save changes" : published ? "Publish" : "Save draft"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
