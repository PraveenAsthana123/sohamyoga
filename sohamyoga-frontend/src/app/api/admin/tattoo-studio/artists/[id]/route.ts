import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: artists } = await client.query(
      `SELECT *, CASE WHEN bpp_expiry IS NOT NULL THEN (bpp_expiry - CURRENT_DATE) ELSE NULL END as bpp_days_remaining
       FROM ts_artist WHERE id = $1`, [params.id]
    );
    if (!artists.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: upcoming } = await client.query(
      `SELECT a.*, CONCAT(c.first_name, ' ', c.last_name) as client_name
       FROM ts_appointment a
       LEFT JOIN ts_client c ON c.id = a.client_id
       WHERE a.artist = $1 AND a.scheduled_at >= NOW() AND a.status NOT IN ('cancelled','no_show')
       ORDER BY a.scheduled_at LIMIT 10`,
      [artists[0].first_name + ' ' + artists[0].last_name]
    );

    const { rows: earnings } = await client.query(
      `SELECT SUM(total_amount) as total_revenue, COUNT(*) as completed_count
       FROM ts_appointment WHERE artist = $1 AND status = 'completed'`,
      [artists[0].first_name + ' ' + artists[0].last_name]
    );

    return NextResponse.json({ artist: artists[0], upcoming_appointments: upcoming, earnings: earnings[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const fields = ['first_name','last_name','stage_name','email','phone','specialties','styles',
    'bloodborne_pathogen_cert_date','bpp_expiry','alberta_health_permit','booth_rent',
    'commission_pct','instagram_handle','portfolio_url','status'];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const f of fields) {
    if (body[f] !== undefined) { updates.push(`${f} = $${idx++}`); values.push(body[f]); }
  }

  if (!updates.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  values.push(params.id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ts_artist SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ artist: rows[0] });
  } finally {
    client.release();
  }
}
