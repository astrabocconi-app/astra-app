// ASTRA guides (exchange, internships, thesis…). SERVER-ONLY.
//
// Same Supabase project and key as the handouts (see materials.ts): the
// `guides` table catalogues PDFs in Storage, grouped by `category` exactly as
// the ASTRA website shows them.

import { fetchTable } from "./materials";
import { guideLanguage, type GuideLanguage } from "./guide-language";

export interface GuideItem {
  id: string;
  title: string;
  url: string;
  language: GuideLanguage;
}
export interface GuideCategory {
  category: string;
  items: GuideItem[];
}

interface GuideRow {
  id: string;
  title: string | null;
  category: string | null;
  file_url: string | null;
  order_index: number | null;
}

// The website hides the MSc catalogue category; it has its own page there.
const HIDDEN = new Set(["magistrali"]);

export async function fetchGuides(): Promise<GuideCategory[]> {
  const rows = await fetchTable<GuideRow>(
    "guides",
    "select=id,title,category,file_url,order_index&is_active=eq.true&order=order_index,title"
  );
  const byCategory = new Map<string, GuideItem[]>();
  for (const r of rows) {
    const url = (r.file_url ?? "").trim();
    const category = (r.category ?? "").trim();
    if (!url.startsWith("http") || !category || HIDDEN.has(category)) continue;
    const title = (r.title ?? "").trim() || "Guide";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push({ id: r.id, title, url, language: guideLanguage(title, url) });
  }
  return [...byCategory.entries()].map(([category, items]) => ({ category, items }));
}
