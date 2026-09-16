import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [recital, performers] = await Promise.all([
      client.query(`SELECT * FROM ms_recital WHERE id=$1`, [params.id]),
      client.query(
        `SELECT p.*,s.first_name,s.last_name,s.instrument
         FROM ms_recital_performer p
         LEFT JOIN ms_student s ON s.id=p.student_id
         WHERE p.recital_id=$1 ORDER BY p.performance_order`,
        [params.id]
      ),
    ]);
    if (!recital.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ recital: recital.rows[0], performers: performers.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const allowed = ['title','event_date','venue','description','ticket_price','status'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { sets.push(`${f}=$${values.length+1}`); values.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    values.push(params.id);
    const r = await client.query(
      `UPDATE ms_recital SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return Response.json({ recital: r.rows[0] });
  } finally {
    client.release();
  }
}
