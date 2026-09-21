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
      CREATE TABLE IF NOT EXISTS electrical_job (
        id SERIAL PRIMARY KEY,
        job_number TEXT DEFAULT ('EJ-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(CAST(nextval('electrical_job_seq') AS TEXT), 4, '0')),
        client_name TEXT NOT NULL, client_email TEXT, client_phone TEXT,
        address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        job_type TEXT DEFAULT 'residential', description TEXT,
        electrician TEXT, estimated_hours NUMERIC(6,2), hourly_rate NUMERIC(8,2),
        amount NUMERIC(10,2), scheduled_date DATE,
        permit_required BOOLEAN DEFAULT false, permit_number TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE SEQUENCE IF NOT EXISTS electrical_job_seq;
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ jobs: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM electrical_job ORDER BY created_at DESC LIMIT 200');
    return Response.json({ jobs: r.rows });
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
    const jobNum = `EJ-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;
    const r = await client.query(
      'INSERT INTO electrical_job (job_number, client_name, address, job_type, electrician, amount, scheduled_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [jobNum, body.client_name ?? '', body.address ?? '', body.job_type ?? 'residential', body.electrician ?? '', body.amount ?? 0, body.scheduled_date ?? null]
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
