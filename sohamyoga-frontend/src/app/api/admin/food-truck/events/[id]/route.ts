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
      `SELECT e.*, t.truck_name, t.cuisine_type FROM ft_event e
       LEFT JOIN ft_truck t ON t.id = e.truck_id WHERE e.id = $1`, [params.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ event: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const fields = ['event_name','event_type','event_date','start_time','end_time','location',
    'location_permit_required','location_permit_obtained','expected_customers','actual_customers',
    'gross_revenue','cogs','status','weather_notes','menu_variant','staff_count','notes'];

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
      `UPDATE ft_event SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ event: rows[0] });
  } finally {
    client.release();
  }
}
