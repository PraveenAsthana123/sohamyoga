import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pawn_item (
        id SERIAL PRIMARY KEY, item_number TEXT,
        description TEXT NOT NULL, category TEXT DEFAULT 'electronics',
        make TEXT, model TEXT, serial_number TEXT, condition TEXT DEFAULT 'good',
        customer_name TEXT, customer_email TEXT, customer_phone TEXT, customer_id_type TEXT,
        appraised_value NUMERIC(10,2), loan_amount NUMERIC(10,2),
        interest_rate NUMERIC(5,2) DEFAULT 20.0,
        pawn_date DATE DEFAULT CURRENT_DATE,
        due_date DATE, redemption_amount NUMERIC(10,2),
        storage_location TEXT,
        status TEXT DEFAULT 'pawned',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ items: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM pawn_item ORDER BY created_at DESC LIMIT 200');
    return Response.json({ items: r.rows });
  } finally { client.release(); }
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
    const itemNum = `PS-${Date.now().toString(36).toUpperCase()}`;
    const r = await client.query(
      'INSERT INTO pawn_item (item_number, description, category, customer_name, appraised_value, loan_amount, pawn_date, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [itemNum, body.description ?? '', body.category ?? 'electronics', body.customer_name ?? '', body.appraised_value ?? 0, body.loan_amount ?? 0, body.pawn_date ?? new Date().toISOString().split('T')[0], body.due_date ?? null]
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
