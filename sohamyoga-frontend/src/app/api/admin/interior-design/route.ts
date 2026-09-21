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
      CREATE TABLE IF NOT EXISTS interior_design_project (
        id SERIAL PRIMARY KEY, project_name TEXT NOT NULL, client_name TEXT, client_email TEXT,
        room_type TEXT DEFAULT 'living-room', style TEXT DEFAULT 'modern',
        designer TEXT, budget NUMERIC(12,2), start_date DATE DEFAULT CURRENT_DATE,
        end_date DATE, status TEXT DEFAULT 'planning',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS design_moodboard (
        id SERIAL PRIMARY KEY, project_id INT REFERENCES interior_design_project(id) ON DELETE CASCADE,
        project_name TEXT, style TEXT, colors TEXT,
        furniture_notes TEXT, lighting_notes TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ projects: [], moods: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [projects, moods] = await Promise.all([
      client.query('SELECT * FROM interior_design_project ORDER BY created_at DESC LIMIT 100'),
      client.query('SELECT * FROM design_moodboard ORDER BY created_at DESC LIMIT 100'),
    ]);
    return Response.json({ projects: projects.rows, moods: moods.rows });
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
      'INSERT INTO interior_design_project (project_name, client_name, room_type, designer, budget) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [body.project_name ?? 'New Project', body.client_name ?? '', body.room_type ?? 'living-room', body.designer ?? '', body.budget ?? 0]
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
