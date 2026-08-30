"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/app/_ui/card";
import { Button } from "@/app/_ui/button";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  FULFILLED: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "To hand over",
  FULFILLED: "Collected",
  CANCELLED: "Cancelled · refunded",
};

export function RedemptionRow({
  id,
  pickupRef,
  status,
  costPoints,
  code,
  createdAt,
  fulfilledAt,
  rewardTitle,
  student,
}: {
  id: string;
  pickupRef: string;
  status: string;
  costPoints: number;
  code: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  rewardTitle: string;
  student: { name: string | null; email: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "fulfil" | "cancel") {
    if (action === "cancel") {
      const extra = code
        ? "\n\nWARNING: this redemption already handed out a voucher code, which the student may have used already. Refunding gives the points back on top of that."
        : "";
      if (
        !window.confirm(
          `Cancel this redemption and refund ${costPoints} points to ${student.name ?? "the student"}?${extra}`,
        )
      ) {
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/redemptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status] ?? ""}`}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
        {/* The reference the student reads out at the desk. */}
        <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-bold text-gray-700">
          {pickupRef}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(createdAt).toLocaleString("en-GB")}
          {fulfilledAt ? ` · collected ${new Date(fulfilledAt).toLocaleDateString("en-GB")}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-semibold text-gray-900">{rewardTitle}</span>
        <span className="text-sm text-gray-500">· {costPoints.toLocaleString()} points</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-100 pt-3 text-sm">
        <span className="font-medium text-gray-700">{student.name ?? "Unnamed"}</span>
        {student.email ? (
          <a
            href={`mailto:${student.email}`}
            className="text-astra-primary underline underline-offset-2 hover:opacity-80"
          >
            {student.email}
          </a>
        ) : (
          <span className="text-xs text-gray-400">account deleted</span>
        )}
        {code && (
          <span className="ml-auto rounded-md bg-astra-light px-2 py-1 font-mono text-xs font-bold text-astra-primary">
            {code}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {status !== "CANCELLED" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => act("cancel")}
            disabled={busy}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
          >
            Cancel &amp; refund
          </button>
          {status === "PENDING" ? (
            <Button onClick={() => act("fulfil")} disabled={busy}>
              {busy ? "Saving…" : "Mark as handed over"}
            </Button>
          ) : (
            <span className="text-xs text-gray-400">Already collected</span>
          )}
        </div>
      )}
    </Card>
  );
}
