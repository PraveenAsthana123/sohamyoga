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
    const [clientRow, projects] = await Promise.all([
      client.query(`SELECT * FROM mr_client WHERE id=$1`, [params.id]),
      client.query(`SELECT id, project_name, project_number, research_type, status, project_fee, delivery_date FROM mr_project WHERE client_id=$1 ORDER BY created_at DESC`, [params.id]),
    ]);
    if (!clientRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...clientRow.rows[0], projects: projects.rows });
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
    const allowed = ['status','notes','research_budget_annual','preferred_methodology'];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
    const { rows } = await client.query(`UPDATE mr_client SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...fields.map(f => body[f])]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
