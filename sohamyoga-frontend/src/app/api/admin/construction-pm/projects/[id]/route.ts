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
      const [proj, tasks, rfis] = await Promise.all([
        client.query(`SELECT p.*, c.company_name AS client_name FROM cpm_project p LEFT JOIN cpm_client c ON c.id = p.client_id WHERE p.id = $1`, [params.id]),
        client.query(`SELECT * FROM cpm_task WHERE project_id = $1 ORDER BY start_date, priority DESC`, [params.id]),
        client.query(`SELECT * FROM cpm_rfis WHERE project_id = $1 ORDER BY submitted_date DESC`, [params.id]),
      ]);
      if (!proj.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...proj.rows[0], tasks: tasks.rows, rfis: rfis.rows });
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
      const fields = ['status','percent_complete','change_orders_total','revised_completion_date','actual_start_date','project_manager','superintendent','safety_incidents','safety_hours_worked','contract_value','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = $${vals.length + 1}`); vals.push(body[f]); }
      }
      if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE cpm_project SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
