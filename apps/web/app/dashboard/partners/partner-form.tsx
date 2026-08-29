"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerItem, DiscountTypeValue } from "@astra/shared";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Textarea, Select, Toggle } from "@/app/_ui/field";
import { ImageInput } from "../_components/image-input";
import { PlusIcon } from "@/app/_ui/icons";

async function send(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data;
}

// Suggested categories — free text, so staff can type a new one at any time;
// these just keep the common ones spelled consistently (they drive the app's filter).
const CATEGORY_SUGGESTIONS = [
  "Food & Drink",
  "Bar & Nightlife",
  "Books & Stationery",
  "Fitness & Wellness",
  "Beauty",
  "Fashion",
  "Culture",
  "Services",
  "Travel",
];

const DISCOUNT_TYPES: { value: DiscountTypeValue; label: string; hint: string }[] = [
  { value: "PERCENT", label: "Percentage off", hint: "Value = percent, e.g. 20" },
  { value: "FIXED", label: "Fixed amount off", hint: "Value = cents, e.g. 500 for €5" },
  { value: "FREEBIE", label: "Freebie", hint: "No value needed" },
  { value: "OTHER", label: "Other", hint: "Shown as the title" },
];

type OfferDraft = {
  id?: string | null;
  title: string;
  description: string;
  discountType: DiscountTypeValue;
  discountValue: string;
};

function toDraft(o: PartnerItem["offers"][number]): OfferDraft {
  return {
    id: o.id,
    title: o.title,
    description: o.description ?? "",
    discountType: o.discountType,
    discountValue: o.discountValue != null ? String(o.discountValue) : "",
  };
}

const EMPTY_OFFER: OfferDraft = {
  title: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "",
};

export function PartnerForm({ id, initial }: { id?: string; initial?: PartnerItem }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [latitude, setLatitude] = useState(initial?.latitude != null ? String(initial.latitude) : "");
  const [longitude, setLongitude] = useState(initial?.longitude != null ? String(initial.longitude) : "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [offers, setOffers] = useState<OfferDraft[]>(
    initial?.offers.length ? initial.offers.map(toDraft) : [{ ...EMPTY_OFFER }],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCoords, setShowCoords] = useState(false);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState<string | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);

  /** Resolve the typed address to a pin so it can be checked before saving. */
  async function lookUpAddress() {
    setLocating(true);
    setLocated(null);
    setLocateError(null);
    try {
      const res = await fetch("/api/admin/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't find that address.");
      setLatitude(String(data.latitude));
      setLongitude(String(data.longitude));
      setLocated(data.matchedAddress);
    } catch (e) {
      setLocateError(e instanceof Error ? e.message : "Couldn't find that address.");
    } finally {
      setLocating(false);
    }
  }

  function patchOffer(index: number, patch: Partial<OfferDraft>) {
    setOffers((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        description,
        category,
        address,
        // Blank coordinates are valid — the venue just won't get a map pin.
        latitude: latitude.trim() === "" ? null : Number(latitude),
        longitude: longitude.trim() === "" ? null : Number(longitude),
        logoUrl,
        active,
        offers: offers
          .filter((o) => o.title.trim() !== "")
          .map((o) => ({
            id: o.id ?? null,
            title: o.title,
            description: o.description,
            discountType: o.discountType,
            discountValue: o.discountValue.trim() === "" ? null : Number(o.discountValue),
          })),
      };
      if (id) await send(`/api/admin/partners/${id}`, "PATCH", payload);
      else await send("/api/admin/partners", "POST", payload);
      router.push("/dashboard/partners");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this partner? It will disappear from the app.")) return;
    setLoading(true);
    try {
      await send(`/api/admin/partners/${id}`, "DELETE");
      router.push("/dashboard/partners");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <Field label="Venue name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Casa di Michele" />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short line students will read on the venue card."
          />
        </Field>
        <Field label="Category" hint="Drives the filter in the app's list view.">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="partner-categories"
            placeholder="e.g. Food & Drink"
          />
          <datalist id="partner-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Address"
          hint="The map pin is worked out from this automatically when you save."
        >
          <Input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setLocated(null);
              setLocateError(null);
            }}
            placeholder="e.g. Via Sarfatti 25, Milano"
          />
        </Field>

        <div className="-mt-2 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={lookUpAddress} disabled={locating || !address.trim()}>
            {locating ? "Looking up…" : "Check pin"}
          </Button>
          {located && (
            <span className="text-xs text-green-700">
              Found <span className="font-medium">{located}</span>
              {latitude && longitude && (
                <span className="text-gray-400">
                  {" "}
                  ({Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)})
                </span>
              )}
            </span>
          )}
          {locateError && <span className="text-xs text-red-600">{locateError}</span>}
          <button
            type="button"
            onClick={() => setShowCoords((v) => !v)}
            className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            {showCoords ? "Hide coordinates" : "Set coordinates manually"}
          </button>
        </div>

        {showCoords && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude">
                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="45.4488"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="9.1887"
                />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-gray-400">
              Only needed when the lookup puts the pin in the wrong spot — a courtyard entrance, say.
              Filled in here, these win over the address. Right-click the exact spot in Google Maps
              and click the numbers to copy them.
            </p>
          </>
        )}
        <Field label="Logo">
          <ImageInput value={logoUrl} onChange={setLogoUrl} hint="Recommended: 400 × 400 px (square)" />
        </Field>
        <Toggle label="Active" hint="Visible in the app" checked={active} onChange={setActive} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Discounts</h2>
          <p className="text-xs text-gray-400">
            What students get here. Removing one hides it from the app but keeps its redemption history.
          </p>
        </div>

        {offers.map((o, i) => {
          const typeMeta = DISCOUNT_TYPES.find((t) => t.value === o.discountType);
          const needsValue = o.discountType === "PERCENT" || o.discountType === "FIXED";
          return (
            <div key={o.id ?? `new-${i}`} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4">
              <Field label="Discount title" required>
                <Input
                  value={o.title}
                  onChange={(e) => patchOffer(i, { title: e.target.value })}
                  placeholder="e.g. 20% off any coffee"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type">
                  <Select
                    value={o.discountType}
                    onChange={(e) => patchOffer(i, { discountType: e.target.value as DiscountTypeValue })}
                  >
                    {DISCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Value" hint={typeMeta?.hint}>
                  <Input
                    type="number"
                    min={0}
                    value={o.discountValue}
                    onChange={(e) => patchOffer(i, { discountValue: e.target.value })}
                    disabled={!needsValue}
                    placeholder={o.discountType === "FIXED" ? "500" : "20"}
                  />
                </Field>
              </div>
              <Field label="Details">
                <Input
                  value={o.description}
                  onChange={(e) => patchOffer(i, { description: e.target.value })}
                  placeholder="e.g. Valid Mon–Fri, one per student per day"
                />
              </Field>
              {offers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOffers((prev) => prev.filter((_, idx) => idx !== i))}
                  className="self-start text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove discount
                </button>
              )}
            </div>
          );
        })}

        <Button variant="secondary" onClick={() => setOffers((prev) => [...prev, { ...EMPTY_OFFER }])}>
          <PlusIcon size={18} /> Add another discount
        </Button>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        {id ? (
          <button onClick={remove} disabled={loading} className="text-sm font-medium text-red-600 hover:text-red-700">
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/dashboard/partners")} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || !name.trim()}>
            {loading ? "Saving…" : id ? "Save changes" : "Create partner"}
          </Button>
        </div>
      </div>
    </div>
  );
}
