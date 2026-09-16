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
    const guard_id = searchParams.get('guard_id');
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');

    let q = `
      SELECT s.*, g.first_name || ' ' || g.last_name AS guard_name, c.company_name
      FROM sec_shift s
      LEFT JOIN sec_guard g ON g.id = s.guard_id
      LEFT JOIN sec_client c ON c.id = s.client_id
      WHERE 1=1
    `;
    const vals: string[] = [];
    let idx = 1;
    if (date) { q += ` AND s.shift_date = $${idx++}`; vals.push(date); }
    if (guard_id) { q += ` AND s.guard_id = $${idx++}`; vals.push(guard_id); }
    if (client_id) { q += ` AND s.client_id = $${idx++}`; vals.push(client_id); }
    if (status) { q += ` AND s.status = $${idx++}`; vals.push(status); }
    q += ` ORDER BY s.shift_date DESC, s.start_time`;

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
      INSERT INTO sec_shift (client_id, guard_id, site_name, site_address, shift_date, start_time, end_time, shift_type, status, break_minutes, bill_rate, pay_rate, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      body.client_id ?? null, body.guard_id ?? null, body.site_name, body.site_address ?? null,
      body.shift_date, body.start_time, body.end_time,
      body.shift_type ?? 'static', body.status ?? 'scheduled',
      body.break_minutes ?? 30, body.bill_rate ?? null, body.pay_rate ?? null, body.notes ?? null,
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
