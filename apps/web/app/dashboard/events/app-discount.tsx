"use client";

import { useEffect, useRef, useState } from "react";
import { Field, Input, Select, Toggle } from "@/app/_ui/field";
import { romeDate } from "@/app/_ui/rome";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";

type EventbriteEvent = {
  id: string;
  name: string;
  start: string | null;
  url: string;
  upcoming: boolean;
  /** Eventbrite's own status: draft, live, started, ended, completed, canceled. */
  status?: string;
};

export type AppDiscountValue = {
  eventbriteEventId: string;
  enabled: boolean;
  percent: string;
  limit: string;
};

/** Eventbrite checkout only accepts our codes on its own domain. */
export function isEventbriteUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)eventbrite\.[a-z.]+$/.test(host);
  } catch {
    return false;
  }
}

/** Blocking problems with the discount block, as short sentences. Empty = fine. */
export function discountProblems(v: AppDiscountValue, ticketUrl: string): string[] {
  if (!(v.enabled && v.eventbriteEventId)) return [];
  const out: string[] = [];
  const percent = Number(v.percent);
  if (!(v.percent.trim() && Number.isInteger(percent) && percent >= 1 && percent <= 100)) {
    out.push("Percent off must be a whole number from 1 to 100");
  }
  if (v.limit.trim()) {
    const limit = Number(v.limit);
    if (!(Number.isInteger(limit) && limit >= 1)) out.push("Max students must be a whole number, or empty for no limit");
  }
  if (ticketUrl.trim() && !isEventbriteUrl(ticketUrl.trim())) {
    out.push("With the in-app discount on, the ticket link must be an Eventbrite link (or empty)");
  }
  return out;
}

const SELLING = new Set(["live", "started"]);

function statusLabel(status: string | undefined) {
  switch (status) {
    case "live":
      return "on sale";
    case "started":
      return "in progress";
    case "ended":
    case "completed":
      return "ended";
    case "canceled":
      return "cancelled";
    case "draft":
      return "draft (not public)";
    default:
      return status || "unknown status";
  }
}

/**
 * "In-app discount" on the event form: link the Eventbrite event, then give
 * students who buy through the app a percentage off. Each student gets their
 * own single-use code the first time they tap "Get tickets".
 */
export function AppDiscount({
  value,
  onChange,
  issued,
  ticketUrl,
  onTicketUrl,
}: {
  value: AppDiscountValue;
  onChange: (v: AppDiscountValue) => void;
  issued?: number;
  ticketUrl: string;
  onTicketUrl: (url: string) => void;
}) {
  const [events, setEvents] = useState<EventbriteEvent[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The event outside the newest-50 list, fetched by id so it can still be described.
  const [extra, setExtra] = useState<EventbriteEvent | null>(null);
  // "missing": Eventbrite says it does not exist. "unknown": it is not in the list and could not be looked up.
  const [extraState, setExtraState] = useState<"missing" | "unknown" | null>(null);
  // The event the saved record points at: relinking it after codes went out breaks those codes.
  const savedId = useRef(value.eventbriteEventId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminFetch<{ configured?: boolean; events?: EventbriteEvent[] }>(
          "/api/admin/eventbrite/events",
        );
        if (cancelled) return;
        setConfigured(data.configured !== false);
        setEvents(data.events ?? []);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e, "Couldn't load Eventbrite events."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (patch: Partial<AppDiscountValue>) => onChange({ ...value, ...patch });
  const inList = events.find((e) => e.id === value.eventbriteEventId);

  // Linked event not in the list (old, or beyond the newest 50): look it up on its own.
  useEffect(() => {
    const id = value.eventbriteEventId;
    setExtra(null);
    setExtraState(null);
    if (!id || loading || !configured || events.some((e) => e.id === id)) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await adminFetch<{ event?: EventbriteEvent | null }>(
          `/api/admin/eventbrite/events?id=${encodeURIComponent(id)}`,
        );
        if (cancelled) return;
        if (data.event) setExtra(data.event);
        // Only an explicit null means "not found"; no `event` key means the lookup is not supported.
        else setExtraState(data.event === null ? "missing" : "unknown");
      } catch {
        if (!cancelled) setExtraState("unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value.eventbriteEventId, loading, configured, events]);

  const linked = inList ?? extra ?? null;
  const hasIssued = (issued ?? 0) > 0;
  const limitNum = value.limit.trim() ? Number(value.limit) : null;
  const capReached = hasIssued && limitNum !== null && Number.isInteger(limitNum) && (issued ?? 0) >= limitNum;
  const relinked = hasIssued && savedId.current !== "" && value.eventbriteEventId !== savedId.current;
  const urlProblem =
    value.enabled && value.eventbriteEventId && ticketUrl.trim() && !isEventbriteUrl(ticketUrl.trim());

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">In-app discount</p>
        <p className="text-xs text-gray-500">
          Students who buy through the app get a personal single-use Eventbrite code, applied automatically at checkout.
        </p>
      </div>

      {loading ? (
        <p role="status" className="text-sm text-gray-500">
          Loading Eventbrite events…
        </p>
      ) : loadError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError} The discount settings below are kept as they are; reload the page to try again.
        </p>
      ) : !configured ? (
        <p className="text-sm text-gray-500">Eventbrite isn&apos;t connected, so in-app discounts are off.</p>
      ) : (
        <>
          <Field label="Eventbrite event" hint="The event tickets are sold on. Newest 50 shown.">
            <Select
              value={value.eventbriteEventId}
              onChange={(e) => {
                const id = e.target.value;
                if (
                  hasIssued &&
                  value.eventbriteEventId &&
                  id !== value.eventbriteEventId &&
                  !confirm(
                    `${issued} student${issued === 1 ? " already has" : "s already have"} a code for the current Eventbrite event. ` +
                      "Those codes only work on that event, so changing it makes them useless at checkout. Change it anyway?",
                  )
                ) {
                  return;
                }
                set({ eventbriteEventId: id, enabled: id ? value.enabled : false });
                // No ticket link yet: the Eventbrite page is the obvious one.
                const picked = events.find((ev) => ev.id === id);
                if (picked?.url && !ticketUrl) onTicketUrl(picked.url);
              }}
            >
              <option value="">Not linked</option>
              {value.eventbriteEventId && !inList && (
                <option value={value.eventbriteEventId}>
                  {extra ? extra.name : `Event ${value.eventbriteEventId}`}
                </option>
              )}
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.start ? ` — ${e.start.slice(0, 10)}` : ""}
                  {e.upcoming ? "" : " (past)"}
                  {e.status && !SELLING.has(e.status) ? ` [${statusLabel(e.status)}]` : ""}
                </option>
              ))}
            </Select>
          </Field>

          {value.eventbriteEventId && linked && (
            <p
              className={`rounded-lg px-3 py-2 text-xs ${
                !linked.status || SELLING.has(linked.status) ? "bg-white text-gray-600" : "bg-red-50 text-red-700"
              }`}
            >
              Linked: <span className="font-medium">{linked.name}</span> — {statusLabel(linked.status)}
              {linked.start ? `, starts ${romeDate(linked.start)}` : ""}
              {linked.status && !SELLING.has(linked.status)
                ? ". Students can't buy tickets for it, so they will fall back to the full price."
                : ""}
            </p>
          )}
          {value.eventbriteEventId && !linked && extraState === "unknown" && (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-gray-600">
              Eventbrite event {value.eventbriteEventId} is older than the newest 50, so its status can&apos;t be shown
              here. Check it on Eventbrite if students report the full price.
            </p>
          )}
          {value.eventbriteEventId && !linked && extraState === "missing" && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              Eventbrite event {value.eventbriteEventId} could not be found. It may have been deleted, so students will
              fall back to the full price. Pick another event or unlink it.
            </p>
          )}

          <Toggle
            label="Discount when buying in the app"
            hint={value.eventbriteEventId ? "Shown on the event in the app" : "Link the Eventbrite event first"}
            checked={value.enabled && Boolean(value.eventbriteEventId)}
            onChange={(on) => {
              if (value.eventbriteEventId) set({ enabled: on, percent: value.percent || "10" });
            }}
          />

          {value.enabled && value.eventbriteEventId && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Percent off" required hint="1–100. 100 makes it free.">
                <Input type="number" min={1} max={100} value={value.percent} onChange={(e) => set({ percent: e.target.value })} />
              </Field>
              <Field label="Max students" hint="Optional. Empty = no limit.">
                <Input
                  type="number"
                  min={1}
                  value={value.limit}
                  onChange={(e) => set({ limit: e.target.value })}
                  placeholder="No limit"
                />
              </Field>
            </div>
          )}

          {urlProblem && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              The ticket link is not an Eventbrite link, so the discount code could not be applied there. Use the
              Eventbrite link or clear the ticket link.
            </p>
          )}

          {relinked && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Codes already issued belong to the previous Eventbrite event and will not work on this one.
            </p>
          )}

          {hasIssued && (
            <p className={`text-xs ${capReached ? "font-medium text-amber-800" : "text-gray-500"}`}>
              {limitNum !== null && Number.isInteger(limitNum)
                ? `${issued} of ${limitNum} codes issued${capReached ? ", cap reached: no new codes will be given out" : ""}. `
                : `${issued} student${issued === 1 ? " has" : "s have"} a code for this event. `}
              Changing the percent only affects new codes. Turning the discount off does not take back codes that students
              already hold.
            </p>
          )}
        </>
      )}
    </div>
  );
}
