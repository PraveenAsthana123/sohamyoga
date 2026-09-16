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
  const upcoming = searchParams.get('upcoming'); // days

  const client = await pool.connect();
  try {
    const where: string[] = ["ld.status = 'pending'"];
    const params: unknown[] = [];
    let i = 1;
    if (matterId) { where.push(`ld.matter_id = $${i++}`); params.push(matterId); }
    if (upcoming) { where.push(`ld.deadline_date <= CURRENT_DATE + $${i++}::interval`); params.push(`${upcoming} days`); }

    const rows = await client.query(`
      SELECT ld.*, lm.matter_number, lm.title AS matter_title, lc.name AS client_name
      FROM legal_deadline ld
      LEFT JOIN legal_matter lm ON lm.id = ld.matter_id
      LEFT JOIN legal_client lc ON lc.id = lm.client_id
      WHERE ${where.join(' AND ')}
      ORDER BY ld.deadline_date ASC
      LIMIT 200
    `, params);

    return Response.json({ deadlines: rows.rows });
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
    const { matter_id, title, deadline_date, type, notes } = body;
    if (!matter_id || !title || !deadline_date) {
      return Response.json({ error: 'matter_id, title, deadline_date required' }, { status: 400 });
    }

    const r = await client.query(`
      INSERT INTO legal_deadline (matter_id, title, deadline_date, type, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [matter_id, title, deadline_date, type, notes]);

    return Response.json({ deadline: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
