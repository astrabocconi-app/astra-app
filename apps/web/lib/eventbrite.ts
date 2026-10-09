// Eventbrite integration. SERVER-ONLY.
//
// ASTRA rewards are mostly discounted or free tickets to our own events. Rather
// than an admin hand-creating discounts on Eventbrite and pasting them into the
// voucher pool one by one, this creates single-use coded discounts through the
// API and hands the codes straight back.
//
// The token is a private (personal) OAuth token — it is read server-side only
// and never reaches the dashboard bundle.

import { upstreamFetch, log, newRequestId } from "./api";

const API = "https://www.eventbriteapi.com/v3";

/** Eventbrite is on the student's "Get tickets" path: never wait longer than this. */
const TIMEOUT_MS = 6_000;

/** Codes are single-use: one discount, one ticket, one student. */
const QUANTITY_PER_CODE = 1;

/**
 * Ambiguous characters are left out so a code read off a phone screen and typed
 * into Eventbrite can't fail on O/0 or I/1.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class EventbriteError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EventbriteError";
  }
}

/** Raised when Eventbrite rejects a code because it already exists. */
export class DuplicateCodeError extends EventbriteError {
  constructor(code: string) {
    super(`Discount code "${code}" already exists on Eventbrite.`);
    this.name = "DuplicateCodeError";
  }
}

function token(): string | null {
  const t = process.env.EVENTBRITE_PRIVATE_TOKEN;
  return t && t.trim() && !t.includes("xxxx") ? t.trim() : null;
}

function orgId(): string | null {
  const o = process.env.EVENTBRITE_ORG_ID;
  return o && o.trim() ? o.trim() : null;
}

export function isEventbriteConfigured(): boolean {
  return token() !== null && orgId() !== null;
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const t = token();
  if (!t) throw new EventbriteError("Eventbrite is not configured.");

  let res: Response;
  try {
    res = await upstreamFetch("eventbrite", `${API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${t}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      timeoutMs: TIMEOUT_MS,
    });
  } catch {
    // upstreamFetch already logged why (timeout, DNS, reset) with the duration.
    throw new EventbriteError("Couldn't reach Eventbrite. Check the connection and try again.");
  }

  // 204s (and DELETE) can come back without a body.
  const text = await res.text().catch(() => "");
  const data = text ? safeJson(text) : {};

  if (!res.ok) {
    const err = data as {
      error?: string;
      error_description?: string;
      error_detail?: { ARGUMENTS_ERROR?: Record<string, string[]> };
    };
    // The detail is for whoever reads the logs; it never reaches a student.
    log("warn", newRequestId(), "eventbrite error", {
      status: res.status,
      method: init?.method ?? "GET",
      detail: (err.error_description ?? err.error ?? "").slice(0, 200),
    });
    if (err.error_detail?.ARGUMENTS_ERROR?.["discount.code"]?.includes("DUPLICATE")) {
      throw new DuplicateCodeError("(generated)");
    }
    if (res.status === 401 || res.status === 403) {
      throw new EventbriteError(
        "Eventbrite rejected the token. It may have been revoked or lacks permission.",
        res.status,
      );
    }
    if (res.status === 429) {
      throw new EventbriteError("Eventbrite is rate limiting us. Try again in a few minutes.", 429);
    }
    throw new EventbriteError(
      err.error_description ?? err.error ?? `Eventbrite returned ${res.status}.`,
      res.status,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export interface EventbriteEvent {
  id: string;
  name: string;
  /** ISO timestamp of the event's local start. */
  start: string | null;
  url: string;
  status: string;
  /** False once the event is over — codes for it are no longer useful. */
  upcoming: boolean;
}

interface RawEvent {
  id: string;
  name?: { text?: string };
  start?: { local?: string; utc?: string };
  url?: string;
  status?: string;
}

/**
 * Events the organisation can still attach discounts to, newest first.
 *
 * Past events are included but flagged, because the useful thing for an admin
 * is to see the whole list and be told which ones are over — an empty picker
 * with no explanation just looks broken.
 */
export async function listEvents(): Promise<EventbriteEvent[]> {
  const org = orgId();
  if (!org) throw new EventbriteError("Eventbrite is not configured.");

  // Follow the continuation token: the picker used to stop at the first 50, so
  // an event beyond them could never be linked. Capped so a huge organisation
  // cannot turn one dashboard load into dozens of calls.
  const raw: RawEvent[] = [];
  let continuation: string | undefined;
  for (let page = 0; page < MAX_EVENT_PAGES; page++) {
    const data = await call<{
      events?: RawEvent[];
      pagination?: { has_more_items?: boolean; continuation?: string };
    }>(
      `/organizations/${org}/events/?order_by=start_desc&page_size=50${
        continuation ? `&continuation=${encodeURIComponent(continuation)}` : ""
      }`,
    );
    raw.push(...(data.events ?? []));
    continuation = data.pagination?.has_more_items ? data.pagination.continuation : undefined;
    if (!continuation) break;
  }
  return raw.map(toEvent);
}

/** One event by id, for showing the status of a linked event that fell outside the list. */
export async function getEvent(eventId: string): Promise<EventbriteEvent | null> {
  if (!/^\d+$/.test(eventId)) return null;
  try {
    return toEvent(await call<RawEvent>(`/events/${eventId}/`));
  } catch (e) {
    if (e instanceof EventbriteError && e.status === 404) return null;
    throw e;
  }
}

const MAX_EVENT_PAGES = 6;

function toEvent(e: RawEvent): EventbriteEvent {
  const start = e.start?.local ?? e.start?.utc ?? null;
  const startsAt = e.start?.utc ? Date.parse(e.start.utc) : NaN;
  return {
    id: e.id,
    name: e.name?.text?.trim() || "(untitled event)",
    start,
    url: e.url ?? "",
    status: e.status ?? "unknown",
    upcoming: Number.isNaN(startsAt) ? false : startsAt > Date.now(),
  };
}

/** A random voucher code. Short enough to type, long enough not to collide. */
export function generateCode(prefix = "ASTRA"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

export interface CreatedDiscount {
  /** Eventbrite's discount id — needed to revoke it later. */
  id: string;
  code: string;
}

/**
 * Create one single-use coded discount on an event.
 *
 * percentOff is 1-100; 100 makes the ticket free, which is how the "free
 * ticket" rewards work.
 */
export async function createDiscount(opts: {
  eventId: string;
  code: string;
  percentOff: number;
}): Promise<CreatedDiscount> {
  const org = orgId();
  if (!org) throw new EventbriteError("Eventbrite is not configured.");
  if (!Number.isFinite(opts.percentOff) || opts.percentOff < 1 || opts.percentOff > 100) {
    throw new EventbriteError("Discount must be between 1% and 100%.");
  }

  try {
    const res = await call<{ id: string; code: string }>(
      `/organizations/${org}/discounts/`,
      {
        method: "POST",
        body: {
          discount: {
            type: "coded",
            code: opts.code,
            event_id: opts.eventId,
            percent_off: String(opts.percentOff),
            quantity_available: QUANTITY_PER_CODE,
          },
        },
      },
    );
    return { id: res.id, code: res.code };
  } catch (e) {
    // Re-throw with the real code so the caller can retry with a fresh one.
    if (e instanceof DuplicateCodeError) throw new DuplicateCodeError(opts.code);
    throw e;
  }
}

/**
 * Revoke a discount. Best-effort: used both to roll back a half-finished batch
 * and to clean up when something is removed, and in neither case should a
 * failure here take down the caller. Callers that must not lose track of a
 * failure go through lib/eventbrite-revoke.ts, which queues it for a retry.
 *
 * Already gone (404) counts as revoked: that is the state we wanted.
 */
export async function deleteDiscount(discountId: string): Promise<boolean> {
  try {
    await call(`/discounts/${discountId}/`, { method: "DELETE" });
    return true;
  } catch (e) {
    return e instanceof EventbriteError && e.status === 404;
  }
}
