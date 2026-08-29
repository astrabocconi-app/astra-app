"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Select, Textarea } from "@/app/_ui/field";

/**
 * Voucher pool for a reward — in practice, Eventbrite discount codes for our
 * own events. Codes are handed out one per redemption, so students get a
 * working code the instant they redeem instead of waiting on someone.
 *
 * Codes can be generated straight onto an Eventbrite event, or pasted in by
 * hand for anything created outside the app.
 */

interface EventbriteEvent {
  id: string;
  name: string;
  start: string | null;
  status: string;
  upcoming: boolean;
}

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

  // Eventbrite generator
  const [events, setEvents] = useState<EventbriteEvent[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [percentOff, setPercentOff] = useState("100");
  const [quantity, setQuantity] = useState("10");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/eventbrite/events", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setEventsError(data?.error?.message ?? "Couldn't load Eventbrite events.");
          return;
        }
        setConfigured(data.configured !== false);
        setEvents(data.events ?? []);
        // Default to the soonest upcoming event — the usual case.
        const upcoming = (data.events ?? []).filter((e: EventbriteEvent) => e.upcoming);
        if (upcoming.length) setEventId(upcoming[upcoming.length - 1].id);
      } catch {
        if (!cancelled) setEventsError("Couldn't load Eventbrite events.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        setDone(
          `Removed ${data.removed} unused code${data.removed === 1 ? "" : "s"}` +
            (data.revoked ? ` · ${data.revoked} revoked on Eventbrite` : "") +
            (data.revokeFailed
              ? ` · ${data.revokeFailed} could not be revoked on Eventbrite`
              : ""),
        );
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/admin/rewards/${rewardId}/codes/eventbrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventId,
          percentOff: Number(percentOff),
          quantity: Number(quantity),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
      setDone(
        `Generated ${data.added} single-use code${data.added === 1 ? "" : "s"} on Eventbrite` +
          (data.failed ? ` · ${data.failed} failed (${data.firstError ?? "unknown"})` : ""),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const claimed = total - available;
  const upcoming = (events ?? []).filter((e) => e.upcoming);
  const past = (events ?? []).filter((e) => !e.upcoming);
  const qty = Number(quantity);
  const pct = Number(percentOff);
  const canGenerate =
    !busy &&
    configured &&
    eventId !== "" &&
    Number.isFinite(qty) &&
    qty >= 1 &&
    qty <= 20 &&
    Number.isFinite(pct) &&
    pct >= 1 &&
    pct <= 100;

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Voucher codes</h2>
        <p className="text-xs text-gray-400">
          Every code is single-use: one code, one ticket, one student. Each redemption hands out a
          different one, so a code can never be reused or passed around. With an empty pool a
          redemption still works — it just waits for someone to fulfil it by hand.
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

      {/* ---- Generate on Eventbrite ---- */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Generate on Eventbrite</h3>
          <p className="text-xs text-gray-400">
            Creates real single-use discounts on the event and drops them straight into the pool.
            No copy-pasting.
          </p>
        </div>

        {!configured ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Eventbrite isn&apos;t connected. Set <code>EVENTBRITE_PRIVATE_TOKEN</code> and{" "}
            <code>EVENTBRITE_ORG_ID</code>, then redeploy.
          </p>
        ) : eventsError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{eventsError}</p>
        ) : events === null ? (
          <p className="text-xs text-gray-400">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No events on the Eventbrite account yet. Publish one, then come back.
          </p>
        ) : (
          <>
            <Field label="Event">
              <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">Choose an event…</option>
                {upcoming.length > 0 && (
                  <optgroup label="Upcoming">
                    {upcoming.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.start ? ` — ${e.start.slice(0, 10)}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {past.length > 0 && (
                  <optgroup label="Past (codes won't be usable)">
                    {past.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.start ? ` — ${e.start.slice(0, 10)}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </Field>

            {upcoming.length === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Every event on the account has already happened. Codes generated for one of these
                won&apos;t be redeemable.
              </p>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <Field label="Discount" hint="100% = free ticket">
                  <Select value={percentOff} onChange={(e) => setPercentOff(e.target.value)}>
                    <option value="100">100% — free ticket</option>
                    <option value="50">50% — half price</option>
                    <option value="25">25% off</option>
                    <option value="10">10% off</option>
                  </Select>
                </Field>
              </div>
              <div className="w-32">
                <Field label="How many" hint="Max 20 per run">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <Button onClick={generate} disabled={!canGenerate}>
              {busy ? "Generating…" : "Generate codes"}
            </Button>
          </>
        )}
      </div>

      {/* ---- Paste in by hand ---- */}
      <Field label="Or paste codes" hint="One per line — duplicates are ignored.">
        <Textarea
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
          placeholder={"ASTRA-7F2K-9QRT\nASTRA-Q4M1-P8LZ"}
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex items-center justify-between">
        {available > 0 ? (
          <button
            onClick={() => {
              if (
                confirm(
                  `Remove the ${available} unused code(s)? Any created through Eventbrite are revoked there too. Codes already given to a student are kept.`,
                )
              ) {
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
        <Button variant="secondary" onClick={() => send("POST", { codes })} disabled={busy || !codes.trim()}>
          {busy ? "Saving…" : "Add pasted codes"}
        </Button>
      </div>
    </Card>
  );
}
