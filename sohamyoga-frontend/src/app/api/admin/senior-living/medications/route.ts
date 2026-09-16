import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const resident_id = searchParams.get('resident_id');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (resident_id) { conditions.push(`m.resident_id = $${idx++}`); vals.push(resident_id); }
    if (status === 'active') { conditions.push(`m.is_active = true`); }
    else if (status === 'inactive') { conditions.push(`m.is_active = false`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT m.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM sl_medications m JOIN sl_residents r ON r.id = m.resident_id
       ${where} ORDER BY r.last_name, m.drug_name`, vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(`
      INSERT INTO sl_medications (resident_id, drug_name, dosage, route, frequency, times_of_day, prescribing_physician, start_date, end_date, controlled_substance, pharmacy_name, notes, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.resident_id, b.drug_name, b.dosage, b.route || 'oral', b.frequency, b.times_of_day || [], b.prescribing_physician, b.start_date || null, b.end_date || null, b.controlled_substance || false, b.pharmacy_name, b.notes, b.is_active !== false]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
