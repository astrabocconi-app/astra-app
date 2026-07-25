// Crawl ASTRA + useful Bocconi sections to PDFs.
//
//   node crawl.mjs
//
// Polite by design: same-host only, path-scoped for unibocconi.it, robots.txt
// respected, rate-limited, depth- and page-capped. Outputs one PDF per page to
// pdfs/ plus a manifest.json mapping file -> source URL (used by ingest.mjs).
//
// Tune SEEDS / ALLOWED_PATHS / limits below before a big run.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "pdfs");

// Where to start. astrabocconi.com is crawled fully; unibocconi.it is scoped to
// the ALLOWED_PATHS prefixes below (student-relevant sections only).
const SEEDS = [
  "https://www.astrabocconi.com/",
  "https://www.unibocconi.it/en/programs",
  "https://www.unibocconi.it/en/campus-services",
  "https://www.unibocconi.it/en/students",
];

// For unibocconi.it, only follow links under these path prefixes (keeps us to
// useful sections, not the whole university site). astrabocconi.com is unscoped.
const ALLOWED_PATHS = {
  "www.unibocconi.it": ["/en/programs", "/en/campus-services", "/en/students", "/en/about-us"],
  "www.astrabocconi.com": ["/"],
  "astrabocconi.com": ["/"],
};

const MAX_PAGES = Number(process.env.MAX_PAGES ?? 300);
const MAX_DEPTH = Number(process.env.MAX_DEPTH ?? 3);
const DELAY_MS = Number(process.env.DELAY_MS ?? 1500); // politeness delay between pages
const NAV_TIMEOUT = 30_000;

const allowedHosts = new Set(Object.keys(ALLOWED_PATHS));

function hostAllowed(u) {
  return allowedHosts.has(u.hostname);
}
function pathAllowed(u) {
  const prefixes = ALLOWED_PATHS[u.hostname] ?? [];
  return prefixes.some((p) => u.pathname.startsWith(p));
}

// Minimal robots.txt: fetch once per host, collect Disallow paths (User-agent: *).
const robotsCache = new Map();
async function disallowedByRobots(u) {
  if (!robotsCache.has(u.hostname)) {
    const rules = [];
    try {
      const res = await fetch(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const txt = await res.text();
        let star = false;
        for (const raw of txt.split("\n")) {
          const line = raw.split("#")[0].trim();
          if (/^user-agent:/i.test(line)) star = line.split(":")[1].trim() === "*";
          else if (star && /^disallow:/i.test(line)) {
            const p = line.split(":")[1]?.trim();
            if (p) rules.push(p);
          }
        }
      }
    } catch {
      // no robots.txt reachable — treat as allow-all
    }
    robotsCache.set(u.hostname, rules);
  }
  return robotsCache.get(u.hostname).some((p) => u.pathname.startsWith(p));
}

function safeName(u) {
  return (u.hostname + u.pathname).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 150) || "index";
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {};
  const seen = new Set();
  const queue = SEEDS.map((url) => ({ url, depth: 0 }));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: "ASTRA-bot/1.0 (+https://astrabocconi.com)" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  let saved = 0;
  while (queue.length && saved < MAX_PAGES) {
    const { url, depth } = queue.shift();
    let u;
    try {
      u = new URL(url);
    } catch {
      continue;
    }
    const key = u.origin + u.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!hostAllowed(u) || !pathAllowed(u)) continue;
    if (await disallowedByRobots(u)) {
      console.log("robots-skip:", key);
      continue;
    }

    try {
      await page.goto(url, { waitUntil: "networkidle" });
    } catch (e) {
      console.log("nav-fail:", key, String(e).slice(0, 80));
      continue;
    }

    const file = `${safeName(u)}.pdf`;
    await page.pdf({ path: path.join(OUT_DIR, file), format: "A4", printBackground: false });
    manifest[file] = key;
    saved++;
    console.log(`[${saved}/${MAX_PAGES}] d${depth}  ${key}`);

    if (depth < MAX_DEPTH) {
      const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
      for (const link of links) {
        try {
          const lu = new URL(link);
          if (hostAllowed(lu) && pathAllowed(lu) && !seen.has(lu.origin + lu.pathname)) {
            queue.push({ url: lu.origin + lu.pathname, depth: depth + 1 });
          }
        } catch {
          /* ignore bad hrefs */
        }
      }
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  await browser.close();
  console.log(`\nDone. Saved ${saved} PDFs to ${OUT_DIR}. Review them, delete junk, then run: npm run ingest`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
