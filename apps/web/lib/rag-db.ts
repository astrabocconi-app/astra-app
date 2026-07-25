// RAG vector store connection. SERVER-ONLY.
//
// The Ask-ASTRA corpus lives on Supabase Postgres (split off the Neon app DB), so
// it has its own connection — a small pooled `pg` client on the transaction
// pooler (works well from serverless). Plain text queries only (no named/prepared
// statements), which is what the transaction pooler supports.

import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.RAG_DATABASE_URL;
    if (!connectionString) throw new Error("RAG_DATABASE_URL is not set.");
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function ragQuery<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

// Vector (HNSW) queries need a higher hnsw.ef_search than pgvector's default (40)
// to get good recall on this corpus — at the default the index returns wrong
// neighbours. SET LOCAL inside a transaction is safe with the transaction pooler.
const EF_SEARCH = 250;
export async function ragVectorQuery<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL hnsw.ef_search = ${EF_SEARCH}`);
    const res = await client.query(text, params);
    await client.query("COMMIT");
    return res.rows as T[];
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
