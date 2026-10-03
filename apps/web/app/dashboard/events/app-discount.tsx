"use client";

import { useEffect, useState } from "react";
import { Field, Input, Select, Toggle } from "@/app/_ui/field";

type EventbriteEvent = { id: string; name: string; start: string | null; url: string; upcoming: boolean };

export type AppDiscountValue = {
  eventbriteEventId: string;
  enabled: boolean;
  percent: string;
  limit: string;
};

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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/eventbrite/events", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) return setLoadError(data?.error?.message ?? "Couldn't load Eventbrite events.");
        setConfigured(data.configured !== false);
        setEvents(data.events ?? []);
      } catch {
        if (!cancelled) setLoadError("Couldn't load Eventbrite events.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (patch: Partial<AppDiscountValue>) => onChange({ ...value, ...patch });
  const linked = events.find((e) => e.id === value.eventbriteEventId);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">In-app discount</p>
        <p className="text-xs text-gray-500">
          Students who buy through the app get a personal single-use Eventbrite code, applied automatically at checkout.
        </p>
      </div>

      {!configured ? (
        <p className="text-sm text-gray-500">Eventbrite isn&apos;t connected, so in-app discounts are off.</p>
      ) : (
        <>
          <Field label="Eventbrite event" hint={loadError ?? "The event tickets are sold on."}>
            <Select
              value={value.eventbriteEventId}
              onChange={(e) => {
                const id = e.target.value;
                set({ eventbriteEventId: id, enabled: id ? value.enabled : false });
                // No ticket link yet: the Eventbrite page is the obvious one.
                const picked = events.find((ev) => ev.id === id);
                if (picked?.url && !ticketUrl) onTicketUrl(picked.url);
              }}
            >
              <option value="">Not linked</option>
              {value.eventbriteEventId && !linked && (
                <option value={value.eventbriteEventId}>Event {value.eventbriteEventId}</option>
              )}
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.start ? ` — ${e.start.slice(0, 10)}` : ""}
                  {e.upcoming ? "" : " (past)"}
                </option>
              ))}
            </Select>
          </Field>

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

          {issued != null && issued > 0 && (
            <p className="text-xs text-gray-500">
              {issued} student{issued === 1 ? " has" : "s have"} a code for this event. Changing the percent only affects
              new codes.
            </p>
          )}
        </>
      )}
    </div>
  );
}
