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
    await client.query(`CREATE TABLE IF NOT EXISTS funeral_arrangements (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      decedent_name TEXT,
      service_type TEXT,
      service_date TIMESTAMPTZ,
      director_name TEXT,
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
    const r = await client.query('SELECT * FROM funeral_arrangements ORDER BY created_at DESC LIMIT 200');
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
      'INSERT INTO funeral_arrangements (name, status, decedent_name, service_type, director_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.name ?? 'New Arrangement', body.status ?? 'active', body.decedent_name ?? '', body.service_type ?? 'full_service', body.director_name ?? '']
    );
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
