"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Select } from "@/app/_ui/field";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { lookUpStudent, type StudentLookup } from "./actions";

type Direction = "grant" | "deduct";

/** From this many points up, the amount has to be typed again to go through. */
const RETYPE_AT = 1000;

type Review = Extract<StudentLookup, { found: true }>;

/**
 * Two steps: fill in the form, then review who gets what (with the current
 * balance) before anything is written. The ledger is append-only, so a typo
 * would otherwise need a second entry to undo.
 */
export function AdjustPointsForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [direction, setDirection] = useState<Direction>("grant");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [retype, setRetype] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const amountNum = Number(amount);
  const amountError =
    amount.trim() === ""
      ? null
      : !Number.isInteger(amountNum)
        ? "The amount must be a whole number of points, without decimals."
        : amountNum < 1
          ? "The amount must be 1 or more. Use Direction to deduct."
          : null;
  const ready = Boolean(email.trim()) && amount.trim() !== "" && !amountError && Boolean(reason.trim());

  const needsRetype = review !== null && amountNum >= RETYPE_AT;
  const retypeOk = !needsRetype || retype.trim() === String(amountNum);
  const overdraw = review !== null && direction === "deduct" && amountNum > review.balance;
  const newBalance = review ? review.balance + (direction === "grant" ? amountNum : -amountNum) : 0;

  async function lookUp() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const found = await lookUpStudent(email);
      if (!found.found) {
        setError(found.reason);
        return;
      }
      setRetype("");
      setReview(found);
    } catch (e) {
      setError(errorMessage(e, "Couldn't look that student up."));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!review || !retypeOk || overdraw) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<{ email: string; balance: number }>("/api/admin/points", {
        method: "POST",
        body: {
          email: review.email,
          delta: direction === "grant" ? amountNum : -amountNum,
          reason: reason.trim(),
        },
      });
      setDone(
        `${direction === "grant" ? "Granted" : "Deducted"} ${amountNum.toLocaleString("en-GB")} points ${
          direction === "grant" ? "to" : "from"
        } ${data.email}. New balance: ${data.balance.toLocaleString("en-GB")}.`,
      );
      setReview(null);
      setEmail("");
      setAmount("");
      setReason("");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't adjust points."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Manual adjustment</h2>
        <p className="text-xs text-gray-500">
          Writes to the same append-only ledger as scans, so the student sees it in their history
          immediately. Adjustments can&apos;t be edited afterwards — post an opposite adjustment to
          correct a mistake.
        </p>
      </div>

      <Field label="Student email" required>
        <Input
          type="email"
          value={email}
          disabled={review !== null}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@studbocconi.it"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Direction">
          <Select
            value={direction}
            disabled={review !== null}
            onChange={(e) => setDirection(e.target.value as Direction)}
          >
            <option value="grant">Grant points</option>
            <option value="deduct">Deduct points</option>
          </Select>
        </Field>
        <Field label="Amount" required hint={amountError ?? "Whole points."}>
          <Input
            type="number"
            min={1}
            step={1}
            value={amount}
            disabled={review !== null}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50"
            aria-invalid={amountError ? true : undefined}
          />
        </Field>
      </div>

      <Field label="Reason" required hint="Shown to the student in their points history.">
        <Input
          value={reason}
          disabled={review !== null}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Helped at the orientation desk"
        />
      </Field>

      {review && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            <span className="font-semibold">{direction === "grant" ? "Grant" : "Deduct"}</span>{" "}
            {amountNum.toLocaleString("en-GB")} points {direction === "grant" ? "to" : "from"}{" "}
            <span className="font-semibold">{review.name ?? "Unnamed student"}</span> (
            <span className="break-all">{review.email}</span>).
          </p>
          <p>
            Balance now {review.balance.toLocaleString("en-GB")}, after{" "}
            <span className="font-semibold">{newBalance.toLocaleString("en-GB")}</span>. Reason: &ldquo;{reason.trim()}&rdquo;.
          </p>
          {overdraw && (
            <p role="alert" className="font-medium text-red-700">
              They only have {review.balance.toLocaleString("en-GB")} points, so this deduction can&apos;t go through.
            </p>
          )}
          {needsRetype && (
            <Field label={`Large adjustment: type ${amountNum} to confirm`}>
              <Input
                inputMode="numeric"
                value={retype}
                onChange={(e) => setRetype(e.target.value)}
                autoComplete="off"
              />
            </Field>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-green-700">
          {done}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {review ? (
          <>
            <Button variant="secondary" onClick={() => setReview(null)} disabled={loading}>
              Back
            </Button>
            <Button onClick={submit} disabled={loading || !retypeOk || overdraw}>
              {loading ? "Saving…" : direction === "grant" ? "Confirm and grant" : "Confirm and deduct"}
            </Button>
          </>
        ) : (
          <Button onClick={lookUp} disabled={loading || !ready}>
            {loading ? "Looking up…" : "Review adjustment"}
          </Button>
        )}
      </div>
    </Card>
  );
}
