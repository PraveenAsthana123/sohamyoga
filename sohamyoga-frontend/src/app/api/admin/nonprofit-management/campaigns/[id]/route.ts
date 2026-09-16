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
    const { rows: campaigns } = await client.query(
      `SELECT *,
        CASE WHEN goal_amount > 0 THEN ROUND(total_raised / goal_amount * 100, 1) ELSE 0 END as progress_pct
       FROM np_campaign WHERE id = $1`, [params.id]
    );
    if (!campaigns.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: donations } = await client.query(
      `SELECT d.*, CONCAT(dn.first_name, ' ', dn.last_name) as donor_name
       FROM np_donation d
       LEFT JOIN np_donor dn ON dn.id = d.donor_id
       WHERE d.campaign_id = $1 ORDER BY d.donation_date DESC`,
      [params.id]
    );

    return NextResponse.json({ campaign: campaigns[0], donations });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const fields = ['name','description','campaign_type','goal_amount','start_date','end_date','status'];

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

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE np_campaign SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ campaign: rows[0] });
  } finally {
    client.release();
  }
}
