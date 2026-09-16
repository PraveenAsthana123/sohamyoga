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
      CREATE TABLE IF NOT EXISTS ai_vendors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        capabilities TEXT[],
        pricing_model TEXT,
        data_residency TEXT[],
        compliance TEXT[],
        score NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'evaluating',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_vendors`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_vendors (name, category, capabilities, pricing_model, data_residency, compliance, score, status, notes) VALUES
        ('OpenAI', 'Foundation Models', ARRAY['GPT-4o','Embeddings','DALL-E','Whisper'], 'per_token', ARRAY['US'], ARRAY['SOC2','GDPR'], 88, 'approved', 'Primary cloud LLM provider'),
        ('Anthropic', 'Foundation Models', ARRAY['Claude-3.5-Sonnet','Claude-3-Haiku'], 'per_token', ARRAY['US'], ARRAY['SOC2','GDPR','HIPAA'], 91, 'approved', 'Used for complex reasoning tasks'),
        ('Ollama', 'Local Inference', ARRAY['llama3.2','mistral','phi3','nomic-embed-text'], 'free_local', ARRAY['on-premise'], ARRAY['No-data-egress'], 95, 'approved', 'Preferred for privacy-sensitive workloads'),
        ('Cohere', 'Foundation Models', ARRAY['Command-R+','Embed-v3','Rerank-v3'], 'per_token', ARRAY['US','EU'], ARRAY['SOC2','GDPR'], 74, 'evaluating', 'Strong RAG embeddings candidate'),
        ('Mistral AI', 'Foundation Models', ARRAY['Mistral-Large','Mistral-8x7B','Codestral'], 'per_token', ARRAY['EU'], ARRAY['GDPR'], 79, 'evaluating', 'EU-based, strong GDPR posture')
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
    const { rows } = await client.query(`SELECT * FROM ai_vendors ORDER BY score DESC`);
    return Response.json({ vendors: rows });
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
  const { name, category, capabilities, pricing_model, data_residency, compliance, notes } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_vendors (name, category, capabilities, pricing_model, data_residency, compliance, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, category, capabilities ?? [], pricing_model, data_residency ?? [], compliance ?? [], notes]
    );
    return Response.json({ vendor: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
