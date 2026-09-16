export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_factory_models (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT,
        type TEXT,
        version TEXT,
        endpoint TEXT,
        status TEXT DEFAULT 'available',
        tags TEXT[],
        performance_score NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_factory_models`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_factory_models (name, provider, type, version, endpoint, status, tags, performance_score) VALUES
        ('llama3.2', 'Ollama', 'text_generation', '3.2', 'http://localhost:11434', 'available', ARRAY['local','chat','free'], 87),
        ('nomic-embed-text', 'Ollama', 'embedding', '1.5', 'http://localhost:11434', 'available', ARRAY['local','embedding','rag'], 91),
        ('phi3', 'Ollama', 'text_generation', '3.8b', 'http://localhost:11434', 'available', ARRAY['local','fast','small'], 78),
        ('gpt-4o', 'OpenAI', 'text_generation', '2024-08', 'https://api.openai.com/v1', 'available', ARRAY['cloud','flagship','vision'], 95),
        ('claude-3-haiku', 'Anthropic', 'text_generation', '20240307', 'https://api.anthropic.com', 'available', ARRAY['cloud','fast','instruction-following'], 89),
        ('yoga-marketing-ft', 'Ollama', 'text_generation', '1.0', 'http://localhost:11434', 'available', ARRAY['local','fine-tuned','marketing'], 82)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM ai_factory_models ORDER BY performance_score DESC`);
    // Federation topology: group by provider
    const byProvider: Record<string, number> = {};
    for (const m of rows) { byProvider[m.provider] = (byProvider[m.provider] ?? 0) + 1; }
    return Response.json({ models: rows, federation: byProvider });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const body = await req.json();
  const { name, provider, type, version, endpoint, tags } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_factory_models (name, provider, type, version, endpoint, tags)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, provider, type, version, endpoint, tags ?? []]
    );
    return Response.json({ model: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
