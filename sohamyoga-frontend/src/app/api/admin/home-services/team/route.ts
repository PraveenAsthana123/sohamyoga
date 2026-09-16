import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const rows = await client.query(`SELECT * FROM hs_team_member WHERE status = 'active' ORDER BY last_name, first_name`);
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO hs_team_member (first_name,last_name,phone,role,hourly_rate,vehicle,background_check_date,certifications) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.first_name, b.last_name, b.phone, b.role ?? 'cleaner', b.hourly_rate, b.vehicle, b.background_check_date, b.certifications ?? []]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
