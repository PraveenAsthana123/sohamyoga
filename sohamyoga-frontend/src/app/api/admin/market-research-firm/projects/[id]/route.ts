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
    const [projRow, dataCollection, findings] = await Promise.all([
      client.query(`SELECT p.*, c.company_name, c.industry FROM mr_project p LEFT JOIN mr_client c ON c.id=p.client_id WHERE p.id=$1`, [id]),
      client.query(`SELECT * FROM mr_data_collection WHERE project_id=$1 ORDER BY created_at DESC`, [id]),
      client.query(`SELECT * FROM mr_finding WHERE project_id=$1 ORDER BY priority, created_at DESC LIMIT 5`, [id]),
    ]);
    if (!projRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...projRow.rows[0], data_collection: dataCollection.rows, findings_summary: findings.rows });
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
    const allowed = ['status','sample_size_actual','lead_researcher','delivery_date','fieldwork_start','fieldwork_end','key_hypotheses'];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
    const { rows } = await client.query(`UPDATE mr_project SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...fields.map(f => body[f])]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
