import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const { actual_customers, gross_revenue, cogs, weather_notes } = body;

  if (gross_revenue === undefined) {
    return NextResponse.json({ error: 'gross_revenue required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ft_event SET
        status = 'completed',
        actual_customers = $1,
        gross_revenue = $2,
        cogs = $3,
        weather_notes = COALESCE($4, weather_notes)
       WHERE id = $5 RETURNING *`,
      [actual_customers, gross_revenue, cogs, weather_notes, params.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const net = rows[0].gross_revenue - (rows[0].cogs ?? 0);
    return NextResponse.json({ event: rows[0], net_revenue: net });
  } finally {
    client.release();
  }
}
