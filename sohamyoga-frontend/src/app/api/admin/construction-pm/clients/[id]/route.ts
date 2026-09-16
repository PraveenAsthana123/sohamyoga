import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [cRow, projects] = await Promise.all([
        client.query(`SELECT * FROM cpm_client WHERE id = $1`, [params.id]),
        client.query(`SELECT id, project_name, project_number, project_type, status, contract_value, percent_complete, original_completion_date FROM cpm_project WHERE client_id = $1 ORDER BY created_at DESC`, [params.id]),
      ]);
      if (!cRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...cRow.rows[0], projects: projects.rows });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = ['company_name','contact_name','contact_email','contact_phone','billing_address','city','province','client_type','status','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = $${vals.length + 1}`); vals.push(body[f]); }
      }
      if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE cpm_client SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
