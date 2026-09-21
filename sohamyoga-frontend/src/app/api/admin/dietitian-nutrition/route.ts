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
      CREATE TABLE IF NOT EXISTS dietitian_client (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
        goal TEXT DEFAULT 'weight-management', dietary_restrictions TEXT, allergies TEXT,
        health_conditions TEXT, dietitian TEXT, status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS meal_plan (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES dietitian_client(id) ON DELETE CASCADE,
        client_name TEXT, plan_name TEXT NOT NULL, calories INT DEFAULT 2000,
        protein_g INT, carbs_g INT, fat_g INT,
        start_date DATE DEFAULT CURRENT_DATE, end_date DATE, status TEXT DEFAULT 'active',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ clients: [], mealPlans: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [clients, mealPlans] = await Promise.all([
      client.query('SELECT * FROM dietitian_client ORDER BY created_at DESC LIMIT 100'),
      client.query('SELECT * FROM meal_plan ORDER BY created_at DESC LIMIT 100'),
    ]);
    return Response.json({ clients: clients.rows, mealPlans: mealPlans.rows });
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
    if (body.type === 'meal_plan') {
      const r = await client.query(
        'INSERT INTO meal_plan (client_name, plan_name, calories) VALUES ($1,$2,$3) RETURNING *',
        [body.client_name ?? '', body.plan_name ?? 'New Plan', body.calories ?? 2000]
      );
      return Response.json(r.rows[0]);
    }
    const r = await client.query(
      'INSERT INTO dietitian_client (name, email, goal) VALUES ($1,$2,$3) RETURNING *',
      [body.name ?? '', body.email ?? '', body.goal ?? 'weight-management']
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
