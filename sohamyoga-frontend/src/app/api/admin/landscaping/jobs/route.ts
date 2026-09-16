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
    const date = searchParams.get('date');
    const service_type = searchParams.get('service_type');
    const status = searchParams.get('status');
    let q = `
      SELECT j.*, c.first_name || ' ' || c.last_name AS client_name, c.address, c.dog_on_property, c.gate_code
      FROM ls_job j LEFT JOIN ls_client c ON c.id = j.client_id WHERE 1=1
    `;
    const vals: string[] = [];
    let idx = 1;
    if (date) { q += ` AND j.job_date = $${idx++}`; vals.push(date); }
    if (service_type) { q += ` AND j.service_type = $${idx++}`; vals.push(service_type); }
    if (status) { q += ` AND j.status = $${idx++}`; vals.push(status); }
    q += ` ORDER BY j.job_date DESC, j.scheduled_time`;
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
      INSERT INTO ls_job (client_id, service_type, job_date, scheduled_time, crew_size, crew_members, price, materials_cost, payment_status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      body.client_id ?? null, body.service_type, body.job_date,
      body.scheduled_time ?? null, body.crew_size ?? 2,
      body.crew_members ?? null, body.price, body.materials_cost ?? 0,
      body.payment_status ?? 'pending', body.notes ?? null,
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
