import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cw_space (
        id SERIAL PRIMARY KEY, space_name TEXT NOT NULL, space_type TEXT NOT NULL
          CHECK (space_type IN ('hot_desk','dedicated_desk','private_office','meeting_room','phone_booth','event_space','lounge')),
        capacity INTEGER DEFAULT 1, floor TEXT, amenities TEXT[],
        hourly_rate DECIMAL(10,2), daily_rate DECIMAL(10,2), monthly_rate DECIMAL(10,2),
        is_available BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const available = searchParams.get('available');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (type) { conditions.push(`space_type = $${idx++}`); values.push(type); }
  if (available !== null) { conditions.push(`is_available = $${idx++}`); values.push(available === 'true'); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM cw_space ${where} ORDER BY space_type, space_name`, values);
    return Response.json({ spaces: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { space_name, space_type, capacity = 1, floor, amenities = [], hourly_rate, daily_rate, monthly_rate } = body;
  if (!space_name || !space_type) return Response.json({ error: 'space_name and space_type required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO cw_space (space_name, space_type, capacity, floor, amenities, hourly_rate, daily_rate, monthly_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [space_name, space_type, capacity, floor, amenities, hourly_rate, daily_rate, monthly_rate]
    );
    return Response.json({ space: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
