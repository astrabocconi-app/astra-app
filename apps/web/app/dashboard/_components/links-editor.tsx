"use client";

import { IN_APP_ROUTES, IN_APP_ROUTE_LABELS, type ContentLink } from "@astra/shared";
import { Field, Input, Select } from "@/app/_ui/field";
import { Button } from "@/app/_ui/button";

const MAX_LINKS = 6;

/**
 * Buttons shown at the bottom of a news post or an event.
 *
 * A link either opens a web page or jumps to a screen inside the app. In-app
 * destinations are a dropdown rather than a free-text path: a typo would
 * produce a button that silently does nothing, which nobody would notice until
 * a student complained.
 */
export function LinksEditor({
  value,
  onChange,
}: {
  value: ContentLink[];
  onChange: (next: ContentLink[]) => void;
}) {
  function update(i: number, patch: Partial<ContentLink>) {
    const current = value[i];
    if (!current) return;
    const next = value.slice();
    // The two kinds carry different `value` shapes, so switching kind resets it
    // rather than carrying a URL over into a route field.
    const merged = { ...current, ...patch } as ContentLink;
    if (patch.kind && patch.kind !== current.kind) {
      merged.value = patch.kind === "internal" ? IN_APP_ROUTES[0] : "";
    }
    next[i] = merged;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Links</h3>
        <p className="text-xs text-gray-400">
          Shown as buttons at the bottom, in order. Each one either opens a web page or takes the
          reader to a screen inside the app.
        </p>
      </div>

      {value.length === 0 && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">No links yet.</p>
      )}

      {value.map((link, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Link {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Button label" required>
              <Input
                value={link.label}
                maxLength={60}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="e.g. Get your ticket"
              />
            </Field>
            <Field label="Goes to">
              <Select
                value={link.kind}
                onChange={(e) => update(i, { kind: e.target.value as ContentLink["kind"] })}
              >
                <option value="external">A web page</option>
                <option value="internal">A screen in the app</option>
              </Select>
            </Field>
          </div>

          {link.kind === "external" ? (
            <Field label="Web address" hint="Must start with https://">
              <Input
                value={link.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="https://www.eventbrite.it/e/..."
              />
            </Field>
          ) : (
            <Field label="Screen">
              <Select value={link.value} onChange={(e) => update(i, { value: e.target.value })}>
                {IN_APP_ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {IN_APP_ROUTE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      ))}

      {value.length < MAX_LINKS && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onChange([...value, { kind: "external", label: "", value: "" }])}
          >
            + Web link
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              onChange([...value, { kind: "internal", label: "", value: IN_APP_ROUTES[0] }])
            }
          >
            + In-app link
          </Button>
        </div>
      )}
    </div>
  );
}
