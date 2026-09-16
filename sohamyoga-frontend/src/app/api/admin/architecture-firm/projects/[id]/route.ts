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
      const [proj, deliverables, timeAgg] = await Promise.all([
        client.query(`SELECT p.*, c.contact_name AS client_name, c.company_name FROM arch_project p LEFT JOIN arch_client c ON c.id = p.client_id WHERE p.id = $1`, [params.id]),
        client.query(`SELECT * FROM arch_deliverable WHERE project_id = $1 ORDER BY due_date`, [params.id]),
        client.query(`SELECT phase, SUM(hours) AS total_hours, SUM(CASE WHEN billable AND NOT billed THEN hours * hourly_rate ELSE 0 END) AS unbilled_value FROM arch_time_entry WHERE project_id = $1 GROUP BY phase`, [params.id]),
      ]);
      if (!proj.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...proj.rows[0], deliverables: deliverables.rows, time_summary: timeAgg.rows });
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
      const fields = ['project_phase','status','billed_to_date','outstanding_balance','permit_submitted','permit_issued','permit_number','construction_start','construction_end','principal','project_architect','project_designer','total_fee','fee_percentage','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = $${vals.length + 1}`); vals.push(body[f]); }
      }
      if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE arch_project SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
