"use client";

import { useRef, useState } from "react";

// Image picker for CMS forms: uploads the chosen file to /api/admin/upload
// (stored in our DB, served via /api/media/:id) and reports back the stored
// path. Also accepts a pasted URL. `value` is whatever gets saved on the record.
export function ImageInput({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Relative /api/media/:id → absolute for the <img> preview.
  const preview = value
    ? value.startsWith("/")
      ? (typeof window !== "undefined" ? window.location.origin : "") + value
      : value
    : "";

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed.");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[11px] text-gray-400">No image</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
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
                onClick={() => onChange("")}
                className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
          <input
            type="url"
            value={value.startsWith("/") ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste an image URL"
            className="w-64 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-astra-accent"
          />
        </div>
      </div>
      {hint && <p className="text-xs font-medium text-gray-500">{hint}</p>}
      <p className="text-xs text-gray-400">JPEG, PNG, WebP or GIF · up to 5 MB.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
