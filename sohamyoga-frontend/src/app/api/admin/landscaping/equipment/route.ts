import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const service_due = searchParams.get('service_due') === 'true';
    let q = `SELECT *, (next_service_date - CURRENT_DATE) AS service_days_remaining FROM ls_equipment WHERE 1=1`;
    const vals: string[] = [];
    let idx = 1;
    if (status) { q += ` AND status = $${idx++}`; vals.push(status); }
    if (service_due) { q += ` AND next_service_date <= CURRENT_DATE + INTERVAL '14 days' AND status != 'retired'`; }
    q += ` ORDER BY next_service_date NULLS LAST, equipment_name`;
    const { rows } = await client.query(q, vals);
    return NextResponse.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { rows } = await client.query(`
      INSERT INTO ls_equipment (equipment_name, equipment_type, make, model, year, serial_number, status, last_service_date, next_service_date, fuel_type, purchase_date, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      body.equipment_name, body.equipment_type ?? null, body.make ?? null, body.model ?? null,
      body.year ?? null, body.serial_number ?? null, body.status ?? 'operational',
      body.last_service_date ?? null, body.next_service_date ?? null,
      body.fuel_type ?? null, body.purchase_date ?? null, body.notes ?? null,
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
