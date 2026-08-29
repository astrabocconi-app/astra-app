"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Textarea } from "@/app/_ui/field";

/**
 * Voucher pool for a reward — in practice, Eventbrite discount codes for our
 * own events. Codes are handed out one per redemption, so students get a
 * working code the instant they redeem instead of waiting on someone.
 */
export function CodePool({
  rewardId,
  total,
  available,
}: {
  rewardId: string;
  total: number;
  available: number;
}) {
  const router = useRouter();
  const [codes, setCodes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(method: "POST" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/admin/rewards/${rewardId}/codes`, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
      if (method === "POST") {
        setDone(
          `Added ${data.added} code${data.added === 1 ? "" : "s"}` +
            (data.skipped ? ` · ${data.skipped} already in the pool` : ""),
        );
        setCodes("");
      } else {
        setDone(`Removed ${data.removed} unused code${data.removed === 1 ? "" : "s"}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const claimed = total - available;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Voucher codes</h2>
        <p className="text-xs text-gray-400">
          Create single-use discount codes on the event&apos;s Eventbrite page, then paste them
          here. Each redemption hands one out automatically. With an empty pool a redemption still
          works — it just waits for someone to fulfil it by hand.
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-400">Available</div>
          <div className="text-xl font-bold text-gray-900">{available}</div>
        </div>
        <div className="flex-1 rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-400">Handed out</div>
          <div className="text-xl font-bold text-gray-900">{claimed}</div>
        </div>
      </div>

      {available === 0 && total > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Every code has been handed out. Add more, or redemptions will queue for manual
          fulfilment.
        </p>
      )}

      <Field label="Add codes" hint="One per line — duplicates are ignored.">
        <Textarea
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
          placeholder={"ASTRA-7F2K9\nASTRA-Q4M1P\nASTRA-B8N3X"}
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex items-center justify-between">
        {available > 0 ? (
          <button
            onClick={() => {
              if (confirm(`Remove the ${available} unused code(s)? Codes already given to a student are kept.`)) {
                void send("DELETE");
              }
            }}
            disabled={busy}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
          >
            Remove unused
          </button>
        ) : (
          <span />
        )}
        <Button onClick={() => send("POST", { codes })} disabled={busy || !codes.trim()}>
          {busy ? "Saving…" : "Add to pool"}
        </Button>
      </div>
    </Card>
  );
}
