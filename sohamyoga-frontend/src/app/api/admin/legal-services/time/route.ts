export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const matterId = searchParams.get('matter_id');
  const unbilledOnly = searchParams.get('unbilled') === 'true';

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (matterId) { where.push(`te.matter_id=$${i++}`); params.push(matterId); }
    if (unbilledOnly) { where.push(`te.billed=false`); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await client.query(`
      SELECT te.*, lm.matter_number, lm.title AS matter_title, lc.name AS client_name
      FROM legal_time_entry te
      LEFT JOIN legal_matter lm ON lm.id = te.matter_id
      LEFT JOIN legal_client lc ON lc.id = lm.client_id
      ${wStr}
      ORDER BY te.date DESC, te.created_at DESC
      LIMIT 500
    `, params);

    const totals = await client.query(`
      SELECT
        COALESCE(SUM(hours), 0) AS total_hours,
        COALESCE(SUM(hours * rate) FILTER (WHERE billed = false), 0) AS unbilled_amount,
        COALESCE(SUM(hours * rate) FILTER (WHERE billed = true), 0) AS billed_amount
      FROM legal_time_entry te
      ${matterId ? `WHERE te.matter_id = $1` : ''}
    `, matterId ? [matterId] : []);

    return Response.json({ entries: rows.rows, totals: totals.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { matter_id, date, description, hours, rate } = body;
    if (!matter_id || !description || !hours) {
      return Response.json({ error: 'matter_id, description, hours required' }, { status: 400 });
    }

    const r = await client.query(`
      INSERT INTO legal_time_entry (matter_id, date, description, hours, rate)
      VALUES ($1, $2, $3, $4, $5) RETURNING *, hours * rate AS amount
    `, [matter_id, date || new Date().toISOString().split('T')[0], description, hours, rate]);

    // Sync matter totals
    await client.query(`
      UPDATE legal_matter SET
        billed_hours = (SELECT COALESCE(SUM(hours), 0) FROM legal_time_entry WHERE matter_id = $1),
        total_fees = (SELECT COALESCE(SUM(hours * rate), 0) FROM legal_time_entry WHERE matter_id = $1)
      WHERE id = $1
    `, [matter_id]);

    return Response.json({ entry: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
