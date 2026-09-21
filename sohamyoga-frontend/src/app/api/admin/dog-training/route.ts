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
      CREATE TABLE IF NOT EXISTS dog_training_client (
        id SERIAL PRIMARY KEY, dog_name TEXT NOT NULL, breed TEXT, owner_name TEXT,
        owner_email TEXT, owner_phone TEXT, training_goal TEXT DEFAULT 'basic-obedience',
        age_months INT, vaccinated BOOLEAN DEFAULT true, trainer TEXT,
        status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dog_training_session (
        id SERIAL PRIMARY KEY, dog_id INT REFERENCES dog_training_client(id) ON DELETE CASCADE,
        dog_name TEXT, trainer TEXT, session_type TEXT DEFAULT 'group',
        scheduled_at TIMESTAMPTZ, duration_min INT DEFAULT 60,
        progress_notes TEXT, status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ dogs: [], sessions: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [dogs, sessions] = await Promise.all([
      client.query('SELECT * FROM dog_training_client ORDER BY created_at DESC LIMIT 100'),
      client.query('SELECT * FROM dog_training_session ORDER BY scheduled_at DESC LIMIT 100'),
    ]);
    return Response.json({ dogs: dogs.rows, sessions: sessions.rows });
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
    const r = await client.query(
      'INSERT INTO dog_training_client (dog_name, breed, owner_name, owner_email, training_goal) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [body.dog_name ?? '', body.breed ?? '', body.owner_name ?? '', body.owner_email ?? '', body.training_goal ?? 'basic-obedience']
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
