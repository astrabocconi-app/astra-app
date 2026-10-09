"use client";

import { useState } from "react";
import { AstraLogo } from "@/app/_ui/logo";
import { POLICIES, type Lang } from "./content";

/** The policy in one language at a time, with a toggle. The URL keeps ?lang= so a link can point at either. */
export function PolicyView({ initial }: { initial: Lang }) {
  const [lang, setLang] = useState<Lang>(initial);
  const p = POLICIES[lang];

  function choose(next: Lang) {
    setLang(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", next);
      window.history.replaceState(null, "", url);
    } catch {
      // The toggle still works without updating the address bar.
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-astra-light text-astra-primary">
            <AstraLogo size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-astra-primary" lang={lang}>
              {p.title}
            </h1>
            <p className="text-xs text-gray-600" lang={lang}>
              {p.subtitle}
            </p>
          </div>
        </div>
        <div role="group" aria-label="Language / Lingua" className="flex overflow-hidden rounded-xl border border-gray-200 text-sm font-medium">
          {(["en", "it"] as const).map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={lang === l}
              onClick={() => choose(l)}
              className={`px-3.5 py-1.5 transition-colors ${
                lang === l ? "bg-astra-primary text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {l === "en" ? "English" : "Italiano"}
            </button>
          ))}
        </div>
      </div>

      <article lang={lang}>
        <p className="mt-6 text-sm italic leading-6 text-gray-600">
          {p.legal}
          <br />
          {p.updatedLabel}: <time dateTime="2026-10-09">{p.updated}</time>
        </p>

        {p.sections.map((s, i) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-lg font-semibold text-astra-primary">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-2 space-y-3 text-sm leading-6 text-gray-700">
              {s.blocks.map((b, j) =>
                "ul" in b ? (
                  <ul key={j} className="list-disc space-y-1 pl-5">
                    {b.ul.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={j}>
                    {b.lead && <strong>{b.lead} </strong>}
                    {b.p}
                  </p>
                ),
              )}
            </div>
          </section>
        ))}
      </article>

      <p className="mt-10 text-center text-xs text-gray-600">{p.footer}</p>
    </main>
  );
}
