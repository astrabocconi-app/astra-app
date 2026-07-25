// Ask-ASTRA RAG. SERVER-ONLY.
//
// Hybrid retrieval over the Neon `Document` corpus (guides, FAQs, OCR'd handouts):
// combines pgvector cosine similarity with Postgres full-text keyword matching via
// (vector-weighted) Reciprocal Rank Fusion, then answers with a grounded, cited
// completion. Only the sources the answer actually CITES are returned, so the
// links shown always match what was used. Falls back to "I don't know" when
// nothing is relevant enough.
//
// IMPORTANT: the query embedding MUST use the same model/dimensions the corpus was
// embedded with (text-embedding-3-large @ 1536 dims — see bocconi-scraper/pipeline).

import OpenAI from "openai";
import { ragQuery, ragVectorQuery } from "./rag-db";

const EMBED_MODEL = "text-embedding-3-large";
const EMBED_DIMS = 1536; // matches Document.embedding vector(1536)
const CHAT_MODEL = "gpt-4o";
const CANDIDATES = 20; // per-arm candidates before fusion
const TOP_K = 6; // passages sent to the model
const RRF_K = 60; // reciprocal-rank-fusion constant
const W_VEC = 1.0; // fusion weight — semantic (vector) similarity leads
const W_KW = 0.5; // fusion weight — keyword arm supplements
const KW_SIM_FLOOR = 0.1; // drop lexical-only keyword hits with no semantic support
// Best cosine similarity below this AND no keyword hits → "not covered". Also the
// floor a source must clear to be shown when the answer cites nothing explicitly.
const MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY ?? 0.25);

// Questions about finding an available classroom are answered by pointing the
// student at the app's own Free@B tool (live room availability), not documents.
const CLASSROOM_RE =
  /free\s*classroom|available\s+(?:class)?room|find\s+a\s+(?:class)?room|study\s+(?:room|space)|where\s+to\s+study|aula\s+libera|aule\s+liber|dove\s+studiare|posto\s+per\s+studiare|free\s*@?\s*b\b/i;
const FREEB_PASSAGE = `The ASTRA app has a built-in tool called Free@B — "Find a free classroom" — that shows live classroom availability on the Bocconi campus. To find a free or available classroom right now, the student should open the app home screen and tap "Find a free classroom" (Free@B). Recommend this tool directly.`;

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface RagSource {
  url: string;
  title: string | null;
  sourceType: string | null;
  page: number | null;
  similarity: number;
}
export interface RagAnswer {
  answer: string;
  sources: RagSource[];
  grounded: boolean;
}

interface Hit {
  id: string;
  content: string;
  title: string | null;
  sourceType: string | null;
  sourceUrl: string;
  year: string | null;
  subject: string | null;
  page: number | null;
  similarity: number;
}

// A numbered context passage. `hit` is null for synthetic passages (app tools),
// which inform the answer but have no clickable source.
interface Passage {
  content: string;
  hit: Hit | null;
}

async function embed(text: string): Promise<string> {
  const res = await openai().embeddings.create({
    model: EMBED_MODEL,
    input: text,
    dimensions: EMBED_DIMS,
  });
  return `[${res.data[0]!.embedding.join(",")}]`; // pgvector literal
}

// Nearest neighbours by cosine distance (<=>). similarity = 1 - distance.
async function vectorSearch(vectorLiteral: string): Promise<Hit[]> {
  return ragVectorQuery<Hit>(
    `SELECT id, content, title, "sourceType", "sourceUrl", year, subject, page,
            1 - (embedding <=> $1::vector) AS similarity
     FROM "Document"
     WHERE embedding IS NOT NULL
     -- Order via the halfvec HNSW index (compact); similarity is still computed
     -- at full vector precision for display.
     ORDER BY embedding::halfvec(1536) <=> $1::halfvec(1536)
     LIMIT $2`,
    [vectorLiteral, CANDIDATES],
  );
}

// Full-text keyword matches (language-agnostic 'simple' config, mixed IT/EN).
async function keywordSearch(question: string, vectorLiteral: string): Promise<Hit[]> {
  return ragQuery<Hit>(
    `SELECT id, content, title, "sourceType", "sourceUrl", year, subject, page,
            1 - (embedding <=> $1::vector) AS similarity
     FROM "Document"
     WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', $2)
     ORDER BY ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', $2)) DESC
     LIMIT $3`,
    [vectorLiteral, question, CANDIDATES],
  );
}

// Weighted Reciprocal Rank Fusion — robust to the cosine/ts_rank scale mismatch,
// with the semantic arm weighted above the lexical one to curb keyword noise.
function fuse(vec: Hit[], kw: Hit[]): Hit[] {
  const score = new Map<string, number>();
  const byId = new Map<string, Hit>();
  const add = (list: Hit[], weight: number) => {
    list.forEach((h, rank) => {
      byId.set(h.id, h);
      score.set(h.id, (score.get(h.id) ?? 0) + weight / (RRF_K + rank + 1));
    });
  };
  add(vec, W_VEC);
  add(kw, W_KW);
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id)!)
    .filter(Boolean);
}

const SYSTEM_PROMPT = `You are ASTRA's assistant for Bocconi University students. Answer using ONLY the numbered context passages provided. Rules:
- Ground every claim in the passages. If they don't contain the answer, say you don't have that information yet and suggest the official ASTRA (astrabocconi.com) or Bocconi (unibocconi.it) site. Never guess or use outside knowledge, and never invent links.
- Cite the passages you actually use inline with bracketed numbers like [1] or [2], matching the passage numbers. Only cite passages you genuinely relied on.
- Some passages describe ASTRA app tools; when one answers the question, recommend that tool directly.
- Reply in the SAME language as the question (Italian or English).
- Be concise, friendly, and practical.`;

export async function askAstra(question: string): Promise<RagAnswer> {
  const vector = await embed(question);
  const [vec, kwRaw] = await Promise.all([
    vectorSearch(vector),
    keywordSearch(question, vector),
  ]);
  // Drop lexical-only keyword hits with no semantic support (noise reduction).
  const kw = kwRaw.filter((h) => (h.similarity ?? 0) >= KW_SIM_FLOOR);

  const isClassroom = CLASSROOM_RE.test(question);
  const bestSim = Math.max(0, ...vec.map((h) => h.similarity ?? 0));

  // Nothing relevant and not an app-tool question → don't cover it.
  if (!isClassroom && vec.length === 0 && kw.length === 0) return notCovered();
  if (!isClassroom && bestSim < MIN_SIMILARITY && kw.length === 0) return notCovered();

  const fused = fuse(vec, kw).slice(0, TOP_K);

  // Build numbered passages; prepend the Free@B tool passage for classroom asks.
  const passages: Passage[] = [];
  if (isClassroom) passages.push({ content: FREEB_PASSAGE, hit: null });
  for (const h of fused) passages.push({ content: h.content, hit: h });

  const context = passages
    .map((p, i) => {
      const h = p.hit;
      const loc = h
        ? [h.title, h.subject, h.year, h.page ? `p.${h.page}` : null].filter(Boolean).join(" · ")
        : "ASTRA app tool";
      return `[${i + 1}] ${loc}\n${p.content}`;
    })
    .join("\n\n---\n\n");

  const completion = await openai().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Context passages:\n${context}\n\nQuestion: ${question}` },
    ],
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate an answer.";

  // Show ONLY the sources the answer actually cited — this is what keeps the
  // link list relevant instead of dumping every retrieved passage.
  const citedNums = new Set(
    [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number.parseInt(m[1]!, 10)),
  );
  let chosen: Hit[] = passages
    .map((p, i) => ({ p, n: i + 1 }))
    .filter(({ p, n }) => p.hit && citedNums.has(n))
    .map(({ p }) => p.hit!);

  // Fallback: if a NON-tool answer cited nothing, show the single most relevant
  // document. (For classroom/tool answers we intentionally show no doc source.)
  if (chosen.length === 0 && !isClassroom) {
    const best = fused.find((h) => (h.similarity ?? 0) >= MIN_SIMILARITY);
    if (best) chosen = [best];
  }

  // Keep only the tightly-relevant cited sources: rank by similarity, drop any
  // that trail the best hit by a wide margin (tangential first-year-guide noise),
  // and cap the list. Prevents the "random links" problem.
  chosen.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  const topSim = chosen[0]?.similarity ?? 0;
  chosen = chosen
    .filter((h) => (h.similarity ?? 0) >= Math.max(MIN_SIMILARITY, topSim - 0.12))
    .slice(0, 3);

  // De-dupe by (title,url), keep best similarity.
  const seen = new Map<string, RagSource>();
  for (const h of chosen) {
    const key = `${h.title ?? ""}|${h.sourceUrl}`;
    const existing = seen.get(key);
    const sim = h.similarity ?? 0;
    if (!existing) {
      seen.set(key, { url: h.sourceUrl, title: h.title, sourceType: h.sourceType, page: h.page, similarity: sim });
    } else if (sim > existing.similarity) {
      existing.similarity = sim;
    }
  }
  const sources = [...seen.values()];

  return { answer, sources, grounded: isClassroom || sources.length > 0 || bestSim >= MIN_SIMILARITY };
}

function notCovered(): RagAnswer {
  return {
    answer:
      "I don't have information about that yet. Try rephrasing, or check the official ASTRA (astrabocconi.com) or Bocconi (unibocconi.it) website.",
    sources: [],
    grounded: false,
  };
}
