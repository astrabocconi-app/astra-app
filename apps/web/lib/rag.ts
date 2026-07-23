// Ask-ASTRA RAG. SERVER-ONLY.
//
// Embeds the question (OpenAI), finds the closest scraped chunks in Neon via
// pgvector cosine distance, and answers with gpt-4o-mini grounded in those
// chunks. Falls back to "I don't know" when nothing is similar enough.

import OpenAI from "openai";
import { prisma } from "@astra/db";

const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims — matches Document.embedding
const CHAT_MODEL = "gpt-4o-mini";
const TOP_K = 5;
// Cosine similarity (1 - distance) below this → treat as "not covered". The
// plan suggested 0.7, which is usually too strict for text-embedding-3-small;
// 0.3 is a sensible default. Tune via RAG_MIN_SIMILARITY.
const MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY ?? 0.3);

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface RagSource {
  url: string;
  similarity: number;
}
export interface RagAnswer {
  answer: string;
  sources: RagSource[];
  grounded: boolean;
}

async function embed(text: string): Promise<string> {
  const res = await openai().embeddings.create({ model: EMBED_MODEL, input: text });
  return `[${res.data[0]!.embedding.join(",")}]`; // pgvector literal
}

async function search(vectorLiteral: string): Promise<{ content: string; sourceUrl: string; similarity: number }[]> {
  // <=> is cosine distance; similarity = 1 - distance. Ordered nearest-first.
  return prisma.$queryRaw<{ content: string; sourceUrl: string; similarity: number }[]>`
    SELECT content, "sourceUrl", 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM "Document"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${TOP_K}
  `;
}

const SYSTEM_PROMPT = `You are ASTRA's assistant, helping Bocconi students. Answer the question using ONLY the information in the provided context passages. If the context doesn't contain the answer, say you don't have that information and suggest checking the official Bocconi or ASTRA website — do not guess or use outside knowledge. Be concise, friendly, and practical. Do not invent links or facts.`;

export async function askAstra(question: string): Promise<RagAnswer> {
  const vector = await embed(question);
  const hits = await search(vector);

  const best = hits[0]?.similarity ?? 0;
  if (hits.length === 0 || best < MIN_SIMILARITY) {
    return {
      answer:
        "I don't have information about that yet. Try rephrasing, or check the official ASTRA (astrabocconi.com) or Bocconi (unibocconi.it) website.",
      sources: [],
      grounded: false,
    };
  }

  const context = hits
    .map((h, i) => `[Passage ${i + 1}] (source: ${h.sourceUrl})\n${h.content}`)
    .join("\n\n---\n\n");

  const completion = await openai().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate an answer.";

  // De-dupe sources by URL, keep the best similarity per URL.
  const byUrl = new Map<string, number>();
  for (const h of hits) byUrl.set(h.sourceUrl, Math.max(byUrl.get(h.sourceUrl) ?? 0, h.similarity));
  const sources = [...byUrl.entries()]
    .map(([url, similarity]) => ({ url, similarity }))
    .sort((a, b) => b.similarity - a.similarity);

  return { answer, sources, grounded: true };
}
