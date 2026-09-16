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
      CREATE TABLE IF NOT EXISTS ai_privacy_assessments (
        id SERIAL PRIMARY KEY,
        system_name TEXT NOT NULL,
        data_types TEXT[],
        pii_present BOOLEAN DEFAULT FALSE,
        retention_days INTEGER,
        encryption TEXT,
        findings TEXT[],
        risk_level TEXT DEFAULT 'medium',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_privacy_assessments`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_privacy_assessments (system_name, data_types, pii_present, retention_days, encryption, findings, risk_level) VALUES
        ('Customer Chatbot', ARRAY['name','email','chat_history'], true, 90, 'TLS-1.3 + AES-256', ARRAY['Chat logs retained 90 days without consent mechanism','No right-to-erasure workflow'], 'high'),
        ('Marketing AI Personalization', ARRAY['browsing_behavior','purchase_history'], true, 365, 'TLS-1.3', ARRAY['365-day retention exceeds PIPEDA recommended minimum','User profiling not disclosed in privacy policy'], 'high'),
        ('Ollama Local Inference', ARRAY['prompt_text'], false, 0, 'disk_encryption', ARRAY['No data egress — all processing on-premise','No retention policy needed'], 'low')
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
    const { rows } = await client.query(`SELECT * FROM ai_privacy_assessments ORDER BY risk_level DESC, created_at DESC`);
    return Response.json({ assessments: rows });
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
  const { system_name, data_types, pii_present, retention_days, encryption, findings, risk_level } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_privacy_assessments (system_name, data_types, pii_present, retention_days, encryption, findings, risk_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [system_name, data_types ?? [], pii_present ?? false, retention_days, encryption, findings ?? [], risk_level ?? 'medium']
    );
    return Response.json({ assessment: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
