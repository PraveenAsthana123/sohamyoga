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
      CREATE TABLE IF NOT EXISTS aifinops_costs (
        id SERIAL PRIMARY KEY,
        model_name TEXT NOT NULL,
        provider TEXT,
        month TEXT,
        token_count BIGINT DEFAULT 0,
        cost_usd NUMERIC DEFAULT 0,
        budget_usd NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM aifinops_costs`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO aifinops_costs (model_name, provider, month, token_count, cost_usd, budget_usd) VALUES
        ('llama3.2', 'Ollama', '2026-07', 1200000, 0, 50),
        ('gpt-4o', 'OpenAI', '2026-07', 450000, 13.50, 20),
        ('llama3.2', 'Ollama', '2026-08', 1800000, 0, 50),
        ('gpt-4o', 'OpenAI', '2026-08', 620000, 18.60, 20),
        ('llama3.2', 'Ollama', '2026-09', 2100000, 0, 50),
        ('gpt-4o', 'OpenAI', '2026-09', 380000, 11.40, 20)
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
    const { rows } = await client.query(`
      SELECT *, ROUND((cost_usd / NULLIF(budget_usd,0) * 100)::numeric, 1) AS pct_used
      FROM aifinops_costs ORDER BY month DESC, model_name
    `);
    const { rows: agg } = await client.query(`
      SELECT
        SUM(cost_usd)::numeric AS total_cost,
        SUM(budget_usd)::numeric AS total_budget,
        SUM(token_count)::bigint AS total_tokens
      FROM aifinops_costs
    `);
    return Response.json({ costs: rows, summary: agg[0] });
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
  const { model_name, provider, month, token_count, cost_usd, budget_usd } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO aifinops_costs (model_name, provider, month, token_count, cost_usd, budget_usd)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [model_name, provider, month, token_count ?? 0, cost_usd ?? 0, budget_usd ?? 0]
    );
    return Response.json({ cost: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
