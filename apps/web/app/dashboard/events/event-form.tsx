"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isoToRomeInput, romeInputToIso, type ContentLink, type EventItem } from "@astra/shared";
import { LinksEditor, linkProblems } from "../_components/links-editor";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Textarea, Toggle } from "@/app/_ui/field";
import { ImageInput } from "../_components/image-input";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { useDirtyGuard } from "../_lib/use-dirty-guard";
import { AppDiscount, discountProblems, type AppDiscountValue } from "./app-discount";

function isHttpsUrl(v: string) {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export function EventForm({ id, initial, issued }: { id?: string; initial?: EventItem; issued?: number }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  // Both inputs hold Milan wall time, whatever timezone this browser is in.
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? isoToRomeInput(initial.startsAt) : "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? isoToRomeInput(initial.endsAt) : "");
  const [externalTicketUrl, setExternalTicketUrl] = useState(initial?.externalTicketUrl ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [links, setLinks] = useState<ContentLink[]>(initial?.links ?? []);
  const [discount, setDiscount] = useState<AppDiscountValue>({
    eventbriteEventId: initial?.eventbriteEventId ?? "",
    enabled: Boolean(initial?.appDiscountPercent),
    percent: initial?.appDiscountPercent ? String(initial.appDiscountPercent) : "",
    limit: initial?.appDiscountLimit ? String(initial.appDiscountLimit) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const guard = useDirtyGuard({
    title, description, location, startsAt, endsAt, externalTicketUrl, imageUrl, published, links, discount,
  });

  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title");
  if (!startsAt) problems.push("Set the start date and time");
  if (startsAt && endsAt && endsAt < startsAt) problems.push("The end must be after the start");
  if (externalTicketUrl.trim() && !isHttpsUrl(externalTicketUrl.trim())) {
    problems.push("The ticket link must be a full address starting with https://");
  }
  problems.push(...discountProblems(discount, externalTicketUrl), ...linkProblems(links));

  async function save() {
    if (problems.length) return;
    setLoading(true);
    setError(null);
    try {
      const on = discount.enabled && Boolean(discount.eventbriteEventId);
      const limit = discount.limit.trim() ? Number(discount.limit) : null;
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        startsAt: romeInputToIso(startsAt),
        endsAt: endsAt ? romeInputToIso(endsAt) : null,
        externalTicketUrl: externalTicketUrl.trim(),
        imageUrl,
        published,
        links,
        eventbriteEventId: discount.eventbriteEventId || null,
        appDiscountPercent: on ? Number(discount.percent) : null,
        appDiscountLimit: on ? limit : null,
      };
      if (id) await adminFetch(`/api/admin/events/${id}`, { method: "PATCH", body: payload });
      else await adminFetch("/api/admin/events", { method: "POST", body: payload });
      guard.release();
      router.push("/dashboard/events");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save."));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this event? This can't be undone.")) return;
    setLoading(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/events/${id}`, { method: "DELETE" });
      guard.release();
      router.push("/dashboard/events");
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
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Launch Night" />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's it about?" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts (Milan time)" required>
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label="Ends (Milan time)" hint="Optional. Must be after the start.">
          <Input type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
      </div>
      <Field label="Location">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Aula Magna, Via Röntgen" />
      </Field>
      <Field label="Ticket link" hint="Where students buy tickets (opens in their browser). Must start with https://">
        <Input
          type="url"
          value={externalTicketUrl}
          onChange={(e) => setExternalTicketUrl(e.target.value)}
          placeholder="https://eventbrite.com/…"
        />
      </Field>
      <Field label="Cover image" composite>
        <ImageInput
          value={imageUrl}
          onChange={setImageUrl}
          onBusy={setUploading}
          hint="Recommended: 1200 × 675 px (16:9 landscape)"
        />
      </Field>
      <AppDiscount
        value={discount}
        onChange={setDiscount}
        issued={issued}
        ticketUrl={externalTicketUrl}
        onTicketUrl={setExternalTicketUrl}
      />
      <Toggle label="Published" hint="Visible in the app" checked={published} onChange={setPublished} />

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
            onClick={() => guard.confirmLeave() && router.push("/dashboard/events")}
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
