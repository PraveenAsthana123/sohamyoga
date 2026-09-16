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
    const rows = await client.query(`SELECT * FROM legal_deadline WHERE matter_id=$1 ORDER BY deadline_date`, [params.id]);
    return Response.json({ deadlines: rows.rows });
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
    const { title, deadline_date, type, notes } = body;
    if (!title || !deadline_date) return Response.json({ error: 'title, deadline_date required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO legal_deadline (matter_id,title,deadline_date,type,notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [params.id, title, deadline_date, type, notes]);

    return Response.json({ deadline: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
