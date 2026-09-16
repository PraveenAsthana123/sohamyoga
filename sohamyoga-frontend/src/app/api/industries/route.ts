export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


import { pool } from '@/lib/db';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS industry_solution (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    description TEXT,
    icon        TEXT,
    is_active   BOOLEAN DEFAULT true,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const { rows } = await client.query(
      `SELECT id, name, slug, description, icon, is_active, sort_order, created_at
       FROM industry_solution
       WHERE is_active = true
       ORDER BY sort_order ASC, name ASC`
    );
    return Response.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
