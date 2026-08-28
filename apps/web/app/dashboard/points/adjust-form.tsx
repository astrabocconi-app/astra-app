"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Select } from "@/app/_ui/field";

type Direction = "grant" | "deduct";

export function AdjustPointsForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [direction, setDirection] = useState<Direction>("grant");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const magnitude = Math.abs(Number(amount));
      const res = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          delta: direction === "grant" ? magnitude : -magnitude,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't adjust points.");
      setDone(
        `${direction === "grant" ? "Granted" : "Deducted"} ${magnitude} points ${
          direction === "grant" ? "to" : "from"
        } ${data.email}. New balance: ${data.balance.toLocaleString()}.`,
      );
      setEmail("");
      setAmount("");
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't adjust points.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Manual adjustment</h2>
        <p className="text-xs text-gray-400">
          Writes to the same append-only ledger as scans, so the student sees it in their history
          immediately. Adjustments can&apos;t be edited afterwards — post an opposite adjustment to
          correct a mistake.
        </p>
      </div>

      <Field label="Student email" required>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@studbocconi.it"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Direction">
          <Select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="grant">Grant points</option>
            <option value="deduct">Deduct points</option>
          </Select>
        </Field>
        <Field label="Amount" required>
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50"
          />
        </Field>
      </div>

      <Field label="Reason" required hint="Shown to the student in their points history.">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Helped at the orientation desk"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading || !email || !amount || !reason.trim()}>
          {loading ? "Saving…" : direction === "grant" ? "Grant points" : "Deduct points"}
        </Button>
      </div>
    </Card>
  );
}
