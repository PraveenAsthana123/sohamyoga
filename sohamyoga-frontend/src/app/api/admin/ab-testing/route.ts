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
    await client.query(`CREATE TABLE IF NOT EXISTS ab_tests (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      test_name TEXT,
      variant_a TEXT,
      variant_b TEXT,
      metric TEXT,
      winner TEXT,
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
    const r = await client.query('SELECT * FROM ab_tests ORDER BY created_at DESC LIMIT 200');
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
      'INSERT INTO ab_tests (name, status, test_name, variant_a, variant_b, metric) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [body.name ?? 'New Test', body.status ?? 'active', body.test_name ?? '', body.variant_a ?? 'A', body.variant_b ?? 'B', body.metric ?? 'conversion']
    );
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
