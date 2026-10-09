"use client";

// The dashboard frame. From `md` up the sidebar sits beside the page; below that
// it collapses into a top bar with a menu button that opens the same sidebar as a
// drawer (the Redemptions desk and Support are used from phones). The sidebar
// itself is built on the server and handed in as `sidebar`.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AstraLogo } from "@/app/_ui/logo";

export function DashboardShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  // Remember WHERE the drawer was opened: moving to another page then closes it
  // by itself, without an effect to reset state.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenAt(null);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-astra-primary focus:shadow"
      >
        Skip to content
      </a>

      {/* Phone / narrow: top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          ref={menuButton}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpenAt(pathname)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 text-astra-primary">
          <AstraLogo size={26} />
          <span className="text-base font-bold tracking-tight">ASTRA</span>
        </Link>
      </header>

      {/* Wide: fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-100 bg-white/80 px-4 py-5 backdrop-blur md:flex">
        {sidebar}
      </aside>

      {/* Phone / narrow: drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpenAt(null)}
            className="absolute inset-0 bg-gray-900/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white px-4 py-5 shadow-xl">
            <button
              ref={closeButton}
              type="button"
              aria-label="Close menu"
              onClick={() => {
                setOpenAt(null);
                menuButton.current?.focus();
              }}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main id="main" tabIndex={-1} className="astra-fade-up min-w-0 flex-1 px-4 py-6 outline-none md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
