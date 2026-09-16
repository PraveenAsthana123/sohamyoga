export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const rows = await client.query(`
      SELECT *, hours*rate AS amount FROM legal_time_entry WHERE matter_id=$1 ORDER BY date DESC
    `, [params.id]);
    const totals = await client.query(`
      SELECT
        COALESCE(SUM(hours),0) AS total_hours,
        COALESCE(SUM(hours*rate) FILTER (WHERE billed=false),0) AS unbilled_amount,
        COALESCE(SUM(hours*rate) FILTER (WHERE billed=true),0) AS billed_amount
      FROM legal_time_entry WHERE matter_id=$1
    `, [params.id]);
    return Response.json({ entries: rows.rows, totals: totals.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { date, description, hours, rate } = body;
    if (!description || !hours) return Response.json({ error: 'description, hours required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO legal_time_entry (matter_id,date,description,hours,rate)
      VALUES ($1,$2,$3,$4,$5) RETURNING *, hours*rate AS amount
    `, [params.id, date||new Date().toISOString().split('T')[0], description, hours, rate]);

    // Update matter billed_hours and total_fees
    await client.query(`
      UPDATE legal_matter SET
        billed_hours = (SELECT COALESCE(SUM(hours),0) FROM legal_time_entry WHERE matter_id=$1),
        total_fees = (SELECT COALESCE(SUM(hours*rate),0) FROM legal_time_entry WHERE matter_id=$1)
      WHERE id=$1
    `, [params.id]);

    return Response.json({ entry: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
