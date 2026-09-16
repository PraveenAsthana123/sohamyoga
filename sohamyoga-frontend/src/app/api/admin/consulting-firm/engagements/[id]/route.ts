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
    const id = parseInt(params.id);
    const [engRow, timeEntries, deliverables] = await Promise.all([
      client.query(`SELECT e.*, c.company_name, c.industry FROM cf_engagement e LEFT JOIN cf_client c ON c.id=e.client_id WHERE e.id=$1`, [id]),
      client.query(`SELECT * FROM cf_time_entry WHERE engagement_id=$1 ORDER BY entry_date DESC`, [id]),
      client.query(`SELECT * FROM cf_deliverable WHERE engagement_id=$1 ORDER BY due_date`, [id]),
    ]);
    if (!engRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...engRow.rows[0], time_entries: timeEntries.rows, deliverables: deliverables.rows });
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
    const allowed = ['status','billed_to_date','actual_hours','key_outcomes','end_date','description'];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
    const { rows } = await client.query(`UPDATE cf_engagement SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...fields.map(f => body[f])]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
