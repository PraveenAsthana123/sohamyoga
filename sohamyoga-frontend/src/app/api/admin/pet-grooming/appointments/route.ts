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
      CREATE TABLE IF NOT EXISTS pg_appointment (
        id SERIAL PRIMARY KEY, pet_id INTEGER REFERENCES pg_pet(id),
        owner_id INTEGER REFERENCES pg_owner(id),
        service_type TEXT NOT NULL CHECK (service_type IN ('full_groom','bath_brush','nail_trim','ear_cleaning','teeth_brushing','de_shed','de_mat','lion_cut','boarding_night','daycare','spa_treatment')),
        scheduled_at TIMESTAMPTZ NOT NULL, groomer TEXT,
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','checked_in','in_progress','ready_for_pickup','completed','cancelled','no_show')),
        price DECIMAL(10,2), tip_amount DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT, duration_minutes INTEGER,
        before_photo_url TEXT, after_photo_url TEXT,
        groomer_notes TEXT, owner_rating INTEGER CHECK (owner_rating BETWEEN 1 AND 5),
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
  const date = searchParams.get('date');
  const groomer = searchParams.get('groomer');
  const status = searchParams.get('status');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (date) { conditions.push(`DATE(a.scheduled_at) = $${idx++}`); values.push(date); }
  if (groomer) { conditions.push(`a.groomer = $${idx++}`); values.push(groomer); }
  if (status) { conditions.push(`a.status = $${idx++}`); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT a.*, p.name AS pet_name, p.species, p.breed,
              o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
       FROM pg_appointment a
       LEFT JOIN pg_pet p ON a.pet_id = p.id
       LEFT JOIN pg_owner o ON a.owner_id = o.id
       ${where} ORDER BY a.scheduled_at ASC LIMIT 200`,
      values
    );
    return Response.json({ appointments: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { pet_id, owner_id, service_type, scheduled_at, groomer, price, duration_minutes } = body;
  if (!pet_id || !owner_id || !service_type || !scheduled_at) {
    return Response.json({ error: 'pet_id, owner_id, service_type, scheduled_at required' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO pg_appointment (pet_id, owner_id, service_type, scheduled_at, groomer, price, duration_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [pet_id, owner_id, service_type, scheduled_at, groomer, price, duration_minutes]
    );
    return Response.json({ appointment: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
