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
      CREATE TABLE IF NOT EXISTS ai_training_programs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        target_audience TEXT,
        format TEXT,
        duration_hours NUMERIC DEFAULT 1,
        modules JSONB DEFAULT '[]',
        status TEXT DEFAULT 'planned',
        enrolled_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_training_programs`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_training_programs (title, target_audience, format, duration_hours, modules, status, enrolled_count) VALUES
        ('AI Literacy for All Staff', 'All employees', 'e-learning', 3, '["What is AI?","AI in your daily work","Responsible AI use","Hands-on: ChatGPT and Ollama basics"]', 'active', 42),
        ('Prompt Engineering Masterclass', 'Marketing, Content, Support teams', 'workshop', 8, '["Prompt anatomy","Chain-of-thought prompting","Few-shot examples","Advanced techniques","Hands-on lab"]', 'active', 18),
        ('AI for Executives: Strategy & Governance', 'C-Suite, Board', 'in-person', 4, '["AI opportunity landscape","ROI frameworks","Governance and risk","Board oversight responsibilities"]', 'planned', 0)
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
    const { rows } = await client.query(`SELECT * FROM ai_training_programs ORDER BY status, created_at DESC`);
    return Response.json({ programs: rows });
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
  const { title, target_audience, format, duration_hours, modules } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_training_programs (title, target_audience, format, duration_hours, modules)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, target_audience, format, duration_hours ?? 1, JSON.stringify(modules ?? [])]
    );
    return Response.json({ program: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
