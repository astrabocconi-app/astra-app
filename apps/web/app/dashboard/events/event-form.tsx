"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventItem } from "@astra/shared";
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

// ISO string → value for <input type="datetime-local"> (local YYYY-MM-DDTHH:mm).
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({ id, initial }: { id?: string; initial?: EventItem }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt));
  const [externalTicketUrl, setExternalTicketUrl] = useState(initial?.externalTicketUrl ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const payload = { title, description, location, startsAt, endsAt, externalTicketUrl, imageUrl, published };
      if (id) await send(`/api/admin/events/${id}`, "PATCH", payload);
      else await send("/api/admin/events", "POST", payload);
      router.push("/dashboard/events");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this event? This can't be undone.")) return;
    setLoading(true);
    try {
      await send(`/api/admin/events/${id}`, "DELETE");
      router.push("/dashboard/events");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <Field label="Title" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Launch Night" />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's it about?" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" required>
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label="Ends" hint="Optional">
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
      </div>
      <Field label="Location">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Aula Magna, Via Röntgen" />
      </Field>
      <Field label="Ticket link" hint="Where students buy tickets (opens in their browser).">
        <Input value={externalTicketUrl} onChange={(e) => setExternalTicketUrl(e.target.value)} placeholder="https://eventbrite.com/…" />
      </Field>
      <Field label="Cover image">
        <ImageInput
          value={imageUrl}
          onChange={setImageUrl}
          hint="Recommended: 1200 × 675 px (16:9 landscape)"
        />
      </Field>
      <Toggle label="Published" hint="Visible in the app" checked={published} onChange={setPublished} />

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
          <Button variant="secondary" onClick={() => router.push("/dashboard/events")} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || !title || !startsAt}>
            {loading ? "Saving…" : id ? "Save changes" : published ? "Publish" : "Save draft"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
