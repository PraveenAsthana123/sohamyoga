import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  if (!databaseConfigured()) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS ai_ingestion_jobs (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      source TEXT,
      records_processed INTEGER DEFAULT 0,
      job_status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ items: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM ai_ingestion_jobs ORDER BY created_at DESC LIMIT 200');
    return Response.json({ items: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      'INSERT INTO ai_ingestion_jobs (name, status, source, records_processed, job_status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.name ?? 'New Job', body.status ?? 'active', body.source ?? '', body.records_processed ?? 0, body.job_status ?? 'pending']
    );
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
