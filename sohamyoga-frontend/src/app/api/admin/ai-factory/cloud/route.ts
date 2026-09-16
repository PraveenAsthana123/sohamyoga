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
      CREATE TABLE IF NOT EXISTS ai_cloud_deployments (
        id SERIAL PRIMARY KEY,
        model_name TEXT NOT NULL,
        cloud_provider TEXT,
        region TEXT,
        instance_type TEXT,
        monthly_cost NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'running',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_cloud_deployments`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_cloud_deployments (model_name, cloud_provider, region, instance_type, monthly_cost, status) VALUES
        ('llama3.2 (local)', 'On-Premise', 'local', 'RTX 4070 GPU server', 0, 'running'),
        ('nomic-embed-text (local)', 'On-Premise', 'local', 'RTX 4070 GPU server', 0, 'running'),
        ('gpt-4o', 'OpenAI', 'us-east-1', 'Managed API', 43.50, 'running'),
        ('claude-3-haiku', 'Anthropic', 'us-east-1', 'Managed API', 12.80, 'running')
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
    const { rows } = await client.query(`SELECT * FROM ai_cloud_deployments ORDER BY monthly_cost DESC`);
    const { rows: totals } = await client.query(`SELECT SUM(monthly_cost)::numeric AS total_monthly FROM ai_cloud_deployments`);
    return Response.json({ deployments: rows, total_monthly: totals[0]?.total_monthly ?? 0 });
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
  const { model_name, cloud_provider, region, instance_type, monthly_cost } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_cloud_deployments (model_name, cloud_provider, region, instance_type, monthly_cost)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [model_name, cloud_provider, region, instance_type, monthly_cost ?? 0]
    );
    return Response.json({ deployment: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
