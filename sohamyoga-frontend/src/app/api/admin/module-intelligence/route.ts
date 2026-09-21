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
    await client.query(`CREATE TABLE IF NOT EXISTS module_registry (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      module_name TEXT,
      version TEXT DEFAULT '1.0',
      health_score INTEGER DEFAULT 100,
      last_run_at TIMESTAMPTZ,
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
    const r = await client.query('SELECT * FROM module_registry ORDER BY created_at DESC LIMIT 200');
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
      'INSERT INTO module_registry (name, status, module_name, version, health_score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.name ?? 'New Module', body.status ?? 'active', body.module_name ?? '', body.version ?? '1.0', body.health_score ?? 100]
    );
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
