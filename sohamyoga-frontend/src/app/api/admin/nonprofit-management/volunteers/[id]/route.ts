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
    const { rows } = await client.query(
      `SELECT *,
        CASE WHEN police_check_expiry IS NOT NULL THEN (police_check_expiry - CURRENT_DATE) ELSE NULL END as days_until_expiry
       FROM np_volunteer WHERE id = $1`, [params.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ volunteer: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Special: log hours
    if (body.add_hours !== undefined) {
      const { rows } = await client.query(
        `UPDATE np_volunteer SET total_hours = total_hours + $1 WHERE id = $2 RETURNING *`,
        [body.add_hours, params.id]
      );
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ volunteer: rows[0] });
    }

    const fields = ['first_name','last_name','email','phone','skills','availability','languages',
      'police_check_date','police_check_expiry','status','notes'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const f of fields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        values.push(body[f]);
      }
    }

    if (!updates.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    values.push(params.id);

    const { rows } = await client.query(
      `UPDATE np_volunteer SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ volunteer: rows[0] });
  } finally {
    client.release();
  }
}
