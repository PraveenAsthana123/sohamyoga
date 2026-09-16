import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { check_in_time, check_out_time, incident_reported, notes } = body;

    // Calculate hours_worked from check_in_time and check_out_time minus break
    let hours_worked: number | null = null;
    if (check_in_time && check_out_time) {
      const [inH, inM] = check_in_time.split(':').map(Number);
      const [outH, outM] = check_out_time.split(':').map(Number);
      const inMins = inH * 60 + inM;
      let outMins = outH * 60 + outM;
      if (outMins <= inMins) outMins += 24 * 60; // overnight shift
      const { rows: shiftRows } = await client.query(`SELECT break_minutes FROM sec_shift WHERE id = $1`, [params.id]);
      const breakMins = shiftRows[0]?.break_minutes ?? 30;
      hours_worked = Math.max(0, (outMins - inMins - breakMins) / 60);
    }

    const { rows } = await client.query(`
      UPDATE sec_shift
      SET status = 'completed',
          check_in_time = COALESCE($2, check_in_time),
          check_out_time = COALESCE($3, check_out_time),
          hours_worked = COALESCE($4, hours_worked),
          incident_reported = COALESCE($5, incident_reported),
          notes = COALESCE($6, notes)
      WHERE id = $1 RETURNING *
    `, [params.id, check_in_time ?? null, check_out_time ?? null, hours_worked, incident_reported ?? false, notes ?? null]);

    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
