"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RewardItem } from "@astra/shared";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Textarea, Toggle } from "@/app/_ui/field";
import { ImageInput } from "../_components/image-input";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { useDirtyGuard } from "../_lib/use-dirty-guard";

const isWhole = (v: string, min: number) => v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= min;

export function RewardForm({
  id,
  initial,
  unusedCodes = 0,
  pendingRedemptions = 0,
}: {
  id?: string;
  initial?: RewardItem;
  /** Unused voucher codes in the pool: deleting the reward revokes them. */
  unusedCodes?: number;
  /** Redemptions not yet handed over: they stay in the queue after a delete. */
  pendingRedemptions?: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [costPoints, setCostPoints] = useState(initial ? String(initial.costPoints) : "");
  const [unlimited, setUnlimited] = useState(initial ? initial.stock === null : true);
  const [stock, setStock] = useState(initial?.stock != null ? String(initial.stock) : "");
  // Default new rewards to one per account — the safe setting for ticket codes.
  const [capPerUser, setCapPerUser] = useState(initial ? initial.perUserLimit !== null : true);
  const [perUserLimit, setPerUserLimit] = useState(
    initial?.perUserLimit != null ? String(initial.perUserLimit) : "1",
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const guard = useDirtyGuard({
    title, description, imageUrl, costPoints, unlimited, stock, capPerUser, perUserLimit, active,
  });

  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title");
  if (!isWhole(costPoints, 0)) problems.push("Cost must be a whole number of points, 0 or more");
  if (!unlimited && !isWhole(stock, 0)) problems.push("Enter the stock, or turn on Unlimited stock");
  if (capPerUser && !isWhole(perUserLimit, 1)) problems.push("Max per account must be a whole number, 1 or more");

  async function save() {
    if (problems.length) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        imageUrl,
        costPoints: Number(costPoints),
        stock: unlimited ? null : Number(stock),
        perUserLimit: capPerUser ? Number(perUserLimit) : null,
        active,
      };
      if (id) await adminFetch(`/api/admin/rewards/${id}`, { method: "PATCH", body: payload });
      else await adminFetch("/api/admin/rewards", { method: "POST", body: payload });
      guard.release();
      router.push("/dashboard/rewards");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save."));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id) return;
    const extra: string[] = [];
    if (unusedCodes > 0) {
      extra.push(
        `${unusedCodes} unused voucher code${unusedCodes === 1 ? "" : "s"} will stop working (Eventbrite codes are revoked too)`,
      );
    }
    if (pendingRedemptions > 0) {
      extra.push(
        `${pendingRedemptions} redemption${pendingRedemptions === 1 ? " is" : "s are"} still waiting to be handed over; they stay in the Redemptions queue`,
      );
    }
    const detail = extra.length ? `\n\nHeads up:\n- ${extra.join("\n- ")}` : "";
    if (!confirm(`Delete this reward? This can't be undone.${detail}`)) return;
    setLoading(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/rewards/${id}`, { method: "DELETE" });
      guard.release();
      router.push("/dashboard/rewards");
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
            step={1}
            value={costPoints}
            onChange={(e) => setCostPoints(e.target.value)}
            placeholder="e.g. 500"
          />
        </Field>
        <Field label="Stock" hint={unlimited ? "Unlimited" : "Units available (required)"}>
          <Input
            type="number"
            min={0}
            step={1}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            disabled={unlimited}
            placeholder="e.g. 20"
          />
        </Field>
      </div>
      <Field
        label="Max per account"
        hint={
          capPerUser
            ? "Stops one student redeeming this over and over to collect codes."
            : "No limit — one account can redeem this as often as it can afford."
        }
      >
        <Input
          type="number"
          min={1}
          step={1}
          value={perUserLimit}
          onChange={(e) => setPerUserLimit(e.target.value)}
          disabled={!capPerUser}
          placeholder="e.g. 1"
        />
      </Field>
      <Field label="Image" composite>
        <ImageInput
          value={imageUrl}
          onChange={setImageUrl}
          onBusy={setUploading}
          hint="Recommended: 800 × 800 px (square)"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Unlimited stock" checked={unlimited} onChange={setUnlimited} />
        <Toggle
          label="Limit per account"
          hint="Recommended for ticket codes"
          checked={capPerUser}
          onChange={setCapPerUser}
        />
        <Toggle label="Active" hint="Visible in the app" checked={active} onChange={setActive} />
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
            onClick={() => guard.confirmLeave() && router.push("/dashboard/rewards")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || uploading || problems.length > 0}>
            {loading ? "Saving…" : id ? "Save changes" : "Create reward"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
