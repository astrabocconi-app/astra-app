"use client";

// Warns before unsaved form edits are thrown away.
//
// `value` is anything JSON-serialisable describing the form; it is compared with
// its first render. Covers closing/reloading the tab (beforeunload) and clicks on
// in-app links. Cancel buttons call `confirmLeave()`; after a successful save call
// `release()` first so navigating away is not blocked.
// ponytail: the browser Back button inside the app is not intercepted (App Router
// has no cancellable hook); reload, close and every link/Cancel are.

import { useCallback, useEffect, useRef } from "react";

const MESSAGE = "You have unsaved changes. Leave without saving?";

export function useDirtyGuard(value: unknown) {
  const initial = useRef<string>(JSON.stringify(value));
  const released = useRef(false);
  const dirty = JSON.stringify(value) !== initial.current;
  const active = useRef(false);
  active.current = dirty && !released.current;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!active.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // Capture phase on document runs before Next's <Link> handler.
    const onClick = (e: MouseEvent) => {
      if (!active.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  /** True when it is fine to leave (clean, released, or the person agreed). */
  const confirmLeave = useCallback(() => !active.current || window.confirm(MESSAGE), []);
  /** Stop guarding — call right before navigating away after a successful save/delete. */
  const release = useCallback(() => {
    released.current = true;
    active.current = false;
  }, []);

  return { dirty, confirmLeave, release };
}
