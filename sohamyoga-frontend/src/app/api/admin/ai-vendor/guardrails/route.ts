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
      CREATE TABLE IF NOT EXISTS ai_guardrails (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        rule_type TEXT,
        pattern TEXT,
        action TEXT DEFAULT 'block',
        enabled BOOLEAN DEFAULT TRUE,
        triggered_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_guardrails`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_guardrails (name, rule_type, pattern, action, enabled, triggered_count) VALUES
        ('Block System Prompt Extraction', 'prompt_injection', 'ignore.*previous.*instruction|output.*system.*prompt', 'block', true, 12),
        ('Block PII Phone Numbers', 'pii_detection', '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', 'redact', true, 34),
        ('Block PII Email Addresses', 'pii_detection', '[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', 'redact', true, 89),
        ('Block Harmful Content', 'content_filter', 'harm|violence|illegal|weapon', 'block', true, 7),
        ('Block Competitor Mentions', 'topic_filter', 'competitor_name|rival_brand', 'redirect', true, 2),
        ('Flag Medical Advice Requests', 'topic_filter', 'diagnose|treat|medication|cure', 'warn', true, 15),
        ('Block Credit Card Numbers', 'pii_detection', '\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', 'block', true, 3),
        ('Limit Response Length', 'output_control', 'length>2000', 'truncate', false, 0)
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
    const { rows } = await client.query(`SELECT * FROM ai_guardrails ORDER BY triggered_count DESC`);
    return Response.json({ guardrails: rows });
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
  const { name, rule_type, pattern, action, enabled } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_guardrails (name, rule_type, pattern, action, enabled)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, rule_type, pattern, action ?? 'block', enabled ?? true]
    );
    return Response.json({ guardrail: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
