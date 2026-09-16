import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const truck_id = searchParams.get('truck_id');
  const status = searchParams.get('status');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (truck_id) { conditions.push(`e.truck_id = $${idx++}`); values.push(truck_id); }
    if (status) { conditions.push(`e.status = $${idx++}`); values.push(status); }
    if (date_from) { conditions.push(`e.event_date >= $${idx++}`); values.push(date_from); }
    if (date_to) { conditions.push(`e.event_date <= $${idx++}`); values.push(date_to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT e.*, t.truck_name, t.cuisine_type,
        CASE WHEN e.gross_revenue IS NOT NULL AND e.cogs IS NOT NULL THEN e.gross_revenue - e.cogs ELSE NULL END as net_revenue,
        CASE WHEN e.gross_revenue > 0 AND e.cogs IS NOT NULL THEN ROUND((e.gross_revenue - e.cogs) / e.gross_revenue * 100, 1) ELSE NULL END as margin_pct
       FROM ft_event e
       LEFT JOIN ft_truck t ON t.id = e.truck_id
       ${where}
       ORDER BY e.event_date DESC, e.start_time`,
      values
    );
    return NextResponse.json({ events: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    truck_id, event_name, event_type = 'street_vending', event_date, start_time, end_time,
    location, location_permit_required = false, location_permit_obtained = false,
    expected_customers, menu_variant, staff_count = 2, notes,
  } = body;

  if (!truck_id || !event_name || !event_date || !start_time || !end_time || !location) {
    return NextResponse.json({ error: 'truck_id, event_name, event_date, start_time, end_time, location required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ft_event (truck_id, event_name, event_type, event_date, start_time, end_time,
        location, location_permit_required, location_permit_obtained, expected_customers,
        menu_variant, staff_count, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [truck_id, event_name, event_type, event_date, start_time, end_time,
        location, location_permit_required, location_permit_obtained, expected_customers,
        menu_variant, staff_count, notes]
    );
    return NextResponse.json({ event: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
