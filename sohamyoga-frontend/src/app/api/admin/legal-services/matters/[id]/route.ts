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
    const [matter, times, deadlines] = await Promise.all([
      client.query(`
        SELECT lm.*, lc.name AS client_name, lc.email AS client_email, lc.hourly_rate AS client_hourly_rate
        FROM legal_matter lm LEFT JOIN legal_client lc ON lc.id=lm.client_id WHERE lm.id=$1
      `, [params.id]),
      client.query(`SELECT * FROM legal_time_entry WHERE matter_id=$1 ORDER BY date DESC`, [params.id]),
      client.query(`SELECT * FROM legal_deadline WHERE matter_id=$1 ORDER BY deadline_date`, [params.id]),
    ]);

    if (!matter.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ matter: matter.rows[0], timeEntries: times.rows, deadlines: deadlines.rows });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const fields = ['title','matter_type','description','court_file_number','opposing_party','assigned_lawyer','assigned_paralegal','status','priority','estimated_hours','disbursements','notes','close_date'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const r = await client.query(`UPDATE legal_matter SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    return Response.json({ matter: r.rows[0] });
  } finally {
    client.release();
  }
}
