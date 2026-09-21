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
    await client.query(`CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      full_name TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      lead_score INTEGER DEFAULT 0,
      assigned_to TEXT,
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
    const r = await client.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 200');
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
      'INSERT INTO leads (name, status, full_name, email, source) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [body.name ?? 'New Lead', body.status ?? 'new', body.full_name ?? '', body.email ?? '', body.source ?? 'organic']
    );
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
