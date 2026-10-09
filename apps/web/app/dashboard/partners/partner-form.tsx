"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerItem, DiscountTypeValue } from "@astra/shared";
import { Button } from "@/app/_ui/button";
import { Card } from "@/app/_ui/card";
import { Field, Input, Textarea, Select, Toggle } from "@/app/_ui/field";
import { ImageInput } from "../_components/image-input";
import { PlusIcon } from "@/app/_ui/icons";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { useDirtyGuard } from "../_lib/use-dirty-guard";

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
  { value: "PERCENT", label: "Percentage off", hint: "Value = percent, 1 to 100, e.g. 20" },
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
  qrEnabled: boolean;
};

function toDraft(o: PartnerItem["offers"][number]): OfferDraft {
  return {
    id: o.id,
    title: o.title,
    description: o.description ?? "",
    discountType: o.discountType,
    discountValue: o.discountValue != null ? String(o.discountValue) : "",
    qrEnabled: o.qrEnabled,
  };
}

const EMPTY_OFFER: OfferDraft = {
  title: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "",
  qrEnabled: true,
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
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
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
  const [logoBusy, setLogoBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const uploading = logoBusy || photoBusy;

  // True once the pin was looked up or typed by hand. Until then, a changed address
  // must not send the old coordinates back, or the server would keep the old pin.
  const coordsTouched = useRef(false);
  const addressChanged = address.trim() !== (initial?.address ?? "").trim();
  const pinFollowsAddress = Boolean(id) && addressChanged && !coordsTouched.current;

  const guard = useDirtyGuard({
    name, description, category, address, latitude, longitude, logoUrl, photoUrl, active, offers,
  });

  // Blocking problems, in plain words.
  const lat = latitude.trim() === "" ? null : Number(latitude);
  const lng = longitude.trim() === "" ? null : Number(longitude);
  const problems: string[] = [];
  if (!name.trim()) problems.push("Add the venue name");
  if (lat !== null && !(Number.isFinite(lat) && lat >= -90 && lat <= 90)) problems.push("Latitude must be between -90 and 90");
  if (lng !== null && !(Number.isFinite(lng) && lng >= -180 && lng <= 180)) problems.push("Longitude must be between -180 and 180");
  if ((lat === null) !== (lng === null)) problems.push("Fill in both latitude and longitude, or neither");
  offers.forEach((o, i) => {
    const n = i + 1;
    if (!o.title.trim()) {
      // An untouched empty row is simply not saved; one with content would be dropped silently.
      if (o.description.trim() || o.discountValue.trim()) {
        problems.push(`Discount ${n} has details but no title (add a title, or remove it)`);
      }
      return;
    }
    const v = o.discountValue.trim();
    const num = Number(v);
    if (o.discountType === "PERCENT" && !(v && Number.isInteger(num) && num >= 1 && num <= 100)) {
      problems.push(`Discount ${n}: percent must be a whole number from 1 to 100`);
    }
    if (o.discountType === "FIXED" && !(v && Number.isInteger(num) && num >= 1)) {
      problems.push(`Discount ${n}: the amount must be a whole number of cents, e.g. 500 for €5`);
    }
  });

  /** Resolve the typed address to a pin so it can be checked before saving. */
  async function lookUpAddress() {
    setLocating(true);
    setLocated(null);
    setLocateError(null);
    try {
      const data = await adminFetch<{ latitude: number; longitude: number; matchedAddress: string }>(
        "/api/admin/geocode",
        { method: "POST", body: { address } },
      );
      coordsTouched.current = true;
      setLatitude(String(data.latitude));
      setLongitude(String(data.longitude));
      setLocated(data.matchedAddress);
    } catch (e) {
      setLocateError(errorMessage(e, "Couldn't find that address."));
    } finally {
      setLocating(false);
    }
  }

  function patchOffer(index: number, patch: Partial<OfferDraft>) {
    setOffers((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  async function save() {
    if (problems.length) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        address: address.trim() || null,
        // Blank coordinates are valid — the venue just won't get a map pin. A changed
        // address with untouched coordinates sends none, so the server re-derives the
        // pin from the new address instead of keeping the old one.
        latitude: pinFollowsAddress ? null : lat,
        longitude: pinFollowsAddress ? null : lng,
        logoUrl,
        photoUrl,
        active,
        offers: offers
          .filter((o) => o.title.trim() !== "")
          .map((o) => ({
            id: o.id ?? null,
            title: o.title.trim(),
            description: o.description.trim() || null,
            discountType: o.discountType,
            discountValue:
              (o.discountType === "PERCENT" || o.discountType === "FIXED") && o.discountValue.trim() !== ""
                ? Number(o.discountValue)
                : null,
            qrEnabled: o.qrEnabled,
          })),
      };
      if (id) await adminFetch(`/api/admin/partners/${id}`, { method: "PATCH", body: payload });
      else await adminFetch("/api/admin/partners", { method: "POST", body: payload });
      guard.release();
      router.push("/dashboard/partners");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save."));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this partner? It will disappear from the app.")) return;
    setLoading(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/partners/${id}`, { method: "DELETE" });
      guard.release();
      router.push("/dashboard/partners");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete."));
    } finally {
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
          hint={
            pinFollowsAddress
              ? "The address changed: the map pin will be recalculated from it when you save. Press Check pin to see where it lands first."
              : "The map pin is worked out from this automatically when you save."
          }
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
                <span className="text-gray-500">
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
                  onChange={(e) => {
                    coordsTouched.current = true;
                    setLatitude(e.target.value);
                  }}
                  placeholder="45.4488"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => {
                    coordsTouched.current = true;
                    setLongitude(e.target.value);
                  }}
                  placeholder="9.1887"
                />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-gray-500">
              Only needed when the lookup puts the pin in the wrong spot — a courtyard entrance, say.
              Filled in here, these win over the address. Right-click the exact spot in Google Maps
              and click the numbers to copy them.
            </p>
          </>
        )}
        <Field label="Logo" composite>
          <ImageInput value={logoUrl} onChange={setLogoUrl} onBusy={setLogoBusy} hint="Recommended: 400 × 400 px (square)" />
        </Field>
        <Field label="Photo" hint="Shown when a student taps into this venue's details." composite>
          <ImageInput value={photoUrl} onChange={setPhotoUrl} onBusy={setPhotoBusy} hint="Recommended: 1200 × 800 px" />
        </Field>
        <Toggle label="Active" hint="Visible in the app" checked={active} onChange={setActive} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Discounts</h2>
          <p className="text-xs text-gray-500">
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
                    min={needsValue ? 1 : 0}
                    max={o.discountType === "PERCENT" ? 100 : undefined}
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
              <Toggle
                label="Redeemed by QR scan"
                hint="On: a student redeems this by having their card QR scanned at the venue. Off: an informal discount with no scan, shown with a different symbol."
                checked={o.qrEnabled}
                onChange={(v) => patchOffer(i, { qrEnabled: v })}
              />
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

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {problems.length > 0 && (
        <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-xs text-amber-800">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {id ? (
          <button
            type="button"
            onClick={remove}
            disabled={loading}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => guard.confirmLeave() && router.push("/dashboard/partners")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={loading || uploading || problems.length > 0}>
            {loading ? "Saving…" : id ? "Save changes" : "Create partner"}
          </Button>
        </div>
      </div>
    </div>
  );
}
