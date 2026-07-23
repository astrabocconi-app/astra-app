# bocconi-scraper

One-off tooling for the **Ask ASTRA** RAG chatbot. Crawls ASTRA + useful Bocconi
pages to PDFs, then ingests them into Neon (pgvector) as embedded chunks. Not
part of the app workspaces — install and run it on its own.

## Prerequisites

- The `Document` table + `vector` extension already exist in Neon (added by the
  `rag_documents` Prisma migration).
- An `OPENAI_API_KEY`.

## 1. Install

```bash
cd bocconi-scraper
npm install
npx playwright install chromium
```

## 2. Crawl → PDFs

```bash
npm run crawl        # tune SEEDS / ALLOWED_PATHS / MAX_PAGES in crawl.mjs first
```

Outputs `pdfs/*.pdf` + `pdfs/manifest.json` (file → source URL). **Review the
PDFs and delete junk** (cookie banners, login walls, empty pages) before ingest.
Scope: `astrabocconi.com` fully; `unibocconi.it` only under the student-relevant
path prefixes in `ALLOWED_PATHS`. robots.txt is respected and requests are
rate-limited (`DELAY_MS`).

## 3. Ingest → Neon

```bash
OPENAI_API_KEY=sk-... npm run ingest
```

Chunks each PDF (~2000 chars), embeds with `text-embedding-3-small` (1536 dims),
and inserts into `"Document"`. **Full refresh** — clears existing rows first.
Reads the DB URL from `../apps/web/.env` (`DIRECT_URL`) or the environment.

## 4. Verify

```sql
SELECT count(*) FROM "Document";
```

Then ask a question in the app (Home → "Ask us anything") or curl `/api/chat`.
