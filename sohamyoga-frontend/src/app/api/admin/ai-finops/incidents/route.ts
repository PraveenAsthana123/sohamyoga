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
      CREATE TABLE IF NOT EXISTS aiops_incidents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        affected_model TEXT,
        root_cause TEXT,
        resolution TEXT,
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM aiops_incidents`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO aiops_incidents (title, severity, status, affected_model, root_cause, resolution) VALUES
        ('gpt-4o latency spike >5s', 'high', 'open', 'gpt-4o', 'OpenAI API regional outage', NULL),
        ('Ollama OOM crash on long context', 'critical', 'open', 'llama3.2', 'Context window exceeded 8k tokens', NULL),
        ('Embedding drift detected in RAG pipeline', 'medium', 'resolved', 'text-embedding-3-small', 'Model version mismatch after update', 'Pinned model version in config'),
        ('Prompt injection attempt logged', 'high', 'resolved', 'llama3.2', 'User crafted adversarial prompt bypassing guardrail', 'Added pattern to guardrail ruleset')
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
    const { rows } = await client.query(`SELECT * FROM aiops_incidents ORDER BY detected_at DESC`);
    const { rows: mttr } = await client.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at))/3600)::numeric,1) AS mttr_hours
      FROM aiops_incidents WHERE resolved_at IS NOT NULL
    `);
    return Response.json({ incidents: rows, mttr_hours: mttr[0]?.mttr_hours ?? null });
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
  const { title, severity, affected_model, root_cause } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO aiops_incidents (title, severity, affected_model, root_cause)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, severity ?? 'medium', affected_model, root_cause]
    );
    return Response.json({ incident: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
