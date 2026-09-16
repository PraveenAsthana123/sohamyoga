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
      CREATE TABLE IF NOT EXISTS ai_technology_decisions (
        id SERIAL PRIMARY KEY,
        use_case TEXT NOT NULL,
        selected_tool TEXT,
        alternatives JSONB DEFAULT '[]',
        rationale TEXT,
        decided_by TEXT,
        decided_at DATE,
        review_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_technology_decisions`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_technology_decisions (use_case, selected_tool, alternatives, rationale, decided_by, decided_at, review_date) VALUES
        ('Content Generation', 'Ollama llama3.2', '["gpt-4o","claude-3-haiku"]', 'Local inference eliminates API costs and keeps marketing content private', 'CTO', '2026-07-01', '2026-12-31'),
        ('Customer Support Chatbot', 'Anthropic Claude-3-Haiku', '["gpt-4o-mini","llama3.2"]', 'Best instruction-following with lowest hallucination rate in testing', 'Head of Product', '2026-08-01', '2027-02-01'),
        ('Semantic Search / RAG Embeddings', 'nomic-embed-text (Ollama)', '["text-embedding-3-small","cohere-embed-v3"]', 'Local embeddings at zero cost; quality comparable to cloud options on our corpus', 'ML Engineer', '2026-08-15', '2027-01-15'),
        ('Image Generation for Marketing', 'DALL-E 3 (OpenAI)', '["Stable Diffusion","Midjourney"]', 'Best brand-safe outputs; integrated with existing OpenAI account', 'CMO', '2026-09-01', '2027-03-01')
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
    const { rows } = await client.query(`SELECT * FROM ai_technology_decisions ORDER BY decided_at DESC`);
    return Response.json({ decisions: rows });
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
  const { use_case, selected_tool, alternatives, rationale, decided_by, decided_at, review_date } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_technology_decisions (use_case, selected_tool, alternatives, rationale, decided_by, decided_at, review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [use_case, selected_tool, JSON.stringify(alternatives ?? []), rationale, decided_by, decided_at, review_date]
    );
    return Response.json({ decision: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
