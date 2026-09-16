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
    const { rows } = await client.query(
      `SELECT g.*, c.first_name, c.last_name FROM st_goal g
       JOIN st_client c ON c.id=g.client_id WHERE g.id=$1`, [parseInt(params.id)]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const b = await req.json();
    // special: mark mastered
    if (b.status === 'mastered') {
      const { rows } = await client.query(
        `UPDATE st_goal SET status='mastered', mastered_date=CURRENT_DATE, progress_notes=$2 WHERE id=$1 RETURNING *`,
        [id, b.progress_notes||null]
      );
      return Response.json(rows[0]);
    }
    const allowed = ['status','goal_description','target_accuracy','target_date','progress_notes','baseline'];
    const fields = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([k], i) => `${k}=$${i + 2}`);
    const values = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([, v]) => v);
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const { rows } = await client.query(`UPDATE st_goal SET ${fields.join(',')} WHERE id=$1 RETURNING *`, [id, ...values]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
