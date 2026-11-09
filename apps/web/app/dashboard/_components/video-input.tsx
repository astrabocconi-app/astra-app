"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";
import { captureFrame } from "../polare/polare-form";

const MAX_BYTES = 100 * 1024 * 1024; // the Blob token's limit
const TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/**
 * Video picker: uploads straight to Vercel Blob (too big for a function body)
 * under content/, and grabs a cover frame into our image store. Reports the
 * video URL and the cover through `onChange`.
 */
export function VideoInput({
  value,
  onChange,
  onBusy,
}: {
  value: string;
  onChange: (video: string, poster: string | null) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onBusy?.(status !== null), [status, onBusy]);

  async function pick(file: File) {
    setError(null);
    if (!TYPES.includes(file.type)) return setError("Use an MP4, MOV or WebM video.");
    if (file.size > MAX_BYTES) return setError(`That video is ${(file.size / 1048576).toFixed(0)} MB. The limit is 100 MB.`);
    try {
      setStatus("Uploading video… 0%");
      const [blob, frame] = await Promise.all([
        upload(`content/${file.name.replace(/[^\w.-]+/g, "_")}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/polare/upload",
          multipart: true,
          onUploadProgress: ({ percentage }) => setStatus(`Uploading video… ${Math.round(percentage)}%`),
        }),
        captureFrame(file),
      ]);
      let poster: string | null = null;
      if (frame) {
        setStatus("Saving cover…");
        const fd = new FormData();
        fd.append("file", frame);
        poster = await adminFetch<{ url: string }>("/api/admin/upload", { method: "POST", form: fd })
          .then((r) => r.url)
          .catch(() => null);
      }
      onChange(blob.url, poster);
    } catch (e) {
      setError(errorMessage(e, "Video upload failed."));
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <video src={value} controls playsInline className="max-h-64 w-full max-w-sm rounded-xl bg-black" />
      ) : (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">No video.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {status ?? (value ? "Replace video" : "Upload video")}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            disabled={status !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
              e.target.value = "";
            }}
          />
        </label>
        {value && status === null && (
          <button
            type="button"
            onClick={() => onChange("", null)}
            className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">MP4, MOV or WebM · up to 100 MB. Vertical (9:16) reads best on a phone.</p>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
