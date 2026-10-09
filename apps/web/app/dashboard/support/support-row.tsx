"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/app/_ui/card";
import { Button } from "@/app/_ui/button";
import { Counter, Textarea } from "@/app/_ui/field";
import { adminFetch, errorMessage } from "../_lib/admin-fetch";

const NOTE_MAX = 2000;

/** Kind → tint. Issues should catch the eye first in a long queue. */
const KIND_STYLE: Record<string, string> = {
  ISSUE: "bg-red-50 text-red-700",
  IDEA: "bg-amber-50 text-amber-800",
  QUESTION: "bg-astra-light text-astra-primary",
};

export function SupportRow({
  id,
  kind,
  kindLabel,
  message,
  status,
  adminNote,
  createdAt,
  platform,
  appVersion,
  sender,
}: {
  id: string;
  kind: string;
  kindLabel: string;
  message: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  platform: string | null;
  appVersion: string | null;
  sender: { name: string | null; email: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(adminNote ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/support/${id}`, { method: "PATCH", body });
      setEditingNote(false);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const resolved = status === "RESOLVED";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            KIND_STYLE[kind] ?? KIND_STYLE.QUESTION
          }`}
        >
          {kindLabel}
        </span>
        <span className="text-xs text-gray-500">{createdAt}</span>
        {(platform || appVersion) && (
          <span className="text-xs text-gray-500">
            · {[platform, appVersion].filter(Boolean).join(" ")}
          </span>
        )}
        {resolved && (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            Resolved
          </span>
        )}
      </div>

      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800 [overflow-wrap:anywhere]">
        {message || "(message removed)"}
      </p>

      {/* Who to write back to — the reason this is tied to an account. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-100 pt-3 text-sm">
        <span className="font-medium text-gray-700">{sender.name ?? "Unnamed"}</span>
        {sender.email ? (
          <a
            href={`mailto:${sender.email}?subject=${encodeURIComponent("Re: your message to ASTRA")}`}
            className="break-all text-astra-primary underline underline-offset-2 hover:opacity-80"
          >
            {sender.email}
          </a>
        ) : (
          <span className="text-xs text-gray-500">account deleted — no reply address</span>
        )}
      </div>

      {adminNote && !editingNote && (
        <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 [overflow-wrap:anywhere]">
          <span className="font-semibold">Note:</span> {adminNote}
        </p>
      )}

      {editingNote && (
        <div className="flex flex-col gap-1">
          <Textarea
            value={note}
            maxLength={NOTE_MAX}
            aria-label="Internal note"
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note — never shown in the app"
          />
          <Counter value={note} max={NOTE_MAX} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {editingNote ? (
          <>
            <button
              type="button"
              onClick={() => {
                setNote(adminNote ?? "");
                setEditingNote(false);
              }}
              disabled={busy}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <Button onClick={() => send({ adminNote: note })} disabled={busy}>
              {busy ? "Saving…" : "Save note"}
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              disabled={busy}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
            >
              {adminNote ? "Edit note" : "Add note"}
            </button>
            <Button
              variant={resolved ? "secondary" : "primary"}
              onClick={() => send({ status: resolved ? "OPEN" : "RESOLVED" })}
              disabled={busy}
            >
              {busy ? "Saving…" : resolved ? "Reopen" : "Mark resolved"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
