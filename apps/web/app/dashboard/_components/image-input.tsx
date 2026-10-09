"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";

// Vercel rejects request bodies over 4.5 MB before our route runs (a bare 413),
// so check 4 MB here and say so, instead of a mute "Upload failed".
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function isHttps(v: string) {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

// Image picker for CMS forms: uploads the chosen file to /api/admin/upload
// (stored in our DB, served via /api/media/:id) and reports back the stored
// path. Also accepts a pasted https URL. `value` is whatever gets saved on the record.
// `onBusy` is true while an upload runs or the pasted URL is unusable, so the
// parent form can hold its Save button.
export function ImageInput({
  value,
  onChange,
  onBusy,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  onBusy?: (busy: boolean) => void;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What is being typed in the URL box; null when it just mirrors `value`.
  const [draft, setDraft] = useState<string | null>(null);

  const draftInvalid = draft !== null && draft.trim() !== "" && !isHttps(draft.trim());

  useEffect(() => {
    onBusy?.(uploading || draftInvalid);
  }, [uploading, draftInvalid, onBusy]);

  // Relative /api/media/:id → absolute for the <img> preview.
  const preview = value
    ? value.startsWith("/")
      ? (typeof window !== "undefined" ? window.location.origin : "") + value
      : value
    : "";

  async function upload(file: File) {
    setError(null);
    if (!TYPES.includes(file.type)) {
      setError("Use a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 4 MB; export a smaller copy and try again.`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await adminFetch<{ url: string }>("/api/admin/upload", { method: "POST", form: fd });
      setDraft(null);
      onChange(data.url);
    } catch (e) {
      setError(errorMessage(e, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          {preview ? (
            <img src={preview} alt="Cover image preview" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[11px] text-gray-500">No image</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  onChange("");
                }}
                className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
          <input
            type="url"
            aria-label="Image URL"
            value={draft ?? (value.startsWith("/") ? "" : value)}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v);
              if (v.trim() === "" || isHttps(v.trim())) onChange(v.trim());
            }}
            onBlur={() => {
              if (!draftInvalid) setDraft(null);
            }}
            placeholder="…or paste an https:// image URL"
            className="w-full max-w-64 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-astra-accent"
          />
          {draftInvalid && (
            <p role="alert" className="max-w-64 text-xs text-red-600">
              Only https:// image links work in the app. Upload the file instead, or paste a link that starts with https://.
            </p>
          )}
        </div>
      </div>
      {hint && <p className="text-xs font-medium text-gray-500">{hint}</p>}
      <p className="text-xs text-gray-500">JPEG, PNG, WebP or GIF · up to 4 MB.</p>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
