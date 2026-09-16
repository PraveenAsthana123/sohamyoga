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
      CREATE TABLE IF NOT EXISTS pg_boarding (
        id SERIAL PRIMARY KEY, pet_id INTEGER REFERENCES pg_pet(id),
        owner_id INTEGER REFERENCES pg_owner(id),
        check_in_date DATE NOT NULL, check_out_date DATE NOT NULL,
        kennel_number TEXT, daily_rate DECIMAL(10,2),
        feeding_instructions TEXT, medication_instructions TEXT,
        exercise_level TEXT DEFAULT 'standard' CHECK (exercise_level IN ('minimal','standard','active')),
        status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved','checked_in','checked_out','cancelled')),
        special_requests TEXT, total_amount DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
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
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (status) { conditions.push(`b.status = $${idx++}`); values.push(status); }
  if (from) { conditions.push(`b.check_out_date >= $${idx++}`); values.push(from); }
  if (to) { conditions.push(`b.check_in_date <= $${idx++}`); values.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT b.*, p.name AS pet_name, p.species, p.breed,
              o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
       FROM pg_boarding b
       LEFT JOIN pg_pet p ON b.pet_id = p.id
       LEFT JOIN pg_owner o ON b.owner_id = o.id
       ${where} ORDER BY b.check_in_date ASC LIMIT 200`,
      values
    );
    return Response.json({ boardings: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { pet_id, owner_id, check_in_date, check_out_date, kennel_number, daily_rate, feeding_instructions, medication_instructions, exercise_level = 'standard', special_requests } = body;
  if (!pet_id || !owner_id || !check_in_date || !check_out_date) {
    return Response.json({ error: 'pet_id, owner_id, check_in_date, check_out_date required' }, { status: 400 });
  }
  // Calculate total
  const nights = Math.max(1, Math.ceil((new Date(check_out_date).getTime() - new Date(check_in_date).getTime()) / 86400000));
  const total_amount = daily_rate ? nights * parseFloat(daily_rate) : null;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO pg_boarding (pet_id, owner_id, check_in_date, check_out_date, kennel_number, daily_rate, feeding_instructions, medication_instructions, exercise_level, special_requests, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [pet_id, owner_id, check_in_date, check_out_date, kennel_number, daily_rate, feeding_instructions, medication_instructions, exercise_level, special_requests, total_amount]
    );
    return Response.json({ boarding: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
