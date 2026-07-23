"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RewardItem } from "@astra/shared";
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

export function RewardForm({ id, initial }: { id?: string; initial?: RewardItem }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [costPoints, setCostPoints] = useState(initial ? String(initial.costPoints) : "");
  const [unlimited, setUnlimited] = useState(initial ? initial.stock === null : true);
  const [stock, setStock] = useState(initial?.stock != null ? String(initial.stock) : "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title,
        description,
        imageUrl,
        costPoints: Number(costPoints),
        stock: unlimited ? null : Number(stock),
        active,
      };
      if (id) await send(`/api/admin/rewards/${id}`, "PATCH", payload);
      else await send("/api/admin/rewards", "POST", payload);
      router.push("/dashboard/rewards");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this reward? This can't be undone.")) return;
    setLoading(true);
    try {
      await send(`/api/admin/rewards/${id}`, "DELETE");
      router.push("/dashboard/rewards");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <Field label="Title" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. ASTRA tote bag" />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What do they get?" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cost (points)" required>
          <Input
            type="number"
            min={0}
            value={costPoints}
            onChange={(e) => setCostPoints(e.target.value)}
            placeholder="e.g. 500"
          />
        </Field>
        <Field label="Stock" hint={unlimited ? "Unlimited" : "Units available"}>
          <Input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            disabled={unlimited}
            placeholder="e.g. 20"
          />
        </Field>
      </div>
      <Field label="Image">
        <ImageInput value={imageUrl} onChange={setImageUrl} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Unlimited stock" checked={unlimited} onChange={setUnlimited} />
        <Toggle label="Active" hint="Visible in the app" checked={active} onChange={setActive} />
      </div>

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
          <Button variant="secondary" onClick={() => router.push("/dashboard/rewards")} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || !title || !costPoints}>
            {loading ? "Saving…" : id ? "Save changes" : "Create reward"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
