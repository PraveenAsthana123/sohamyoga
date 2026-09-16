import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string; rfiId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM cpm_rfis WHERE id = $1 AND project_id = $2`, [params.rfiId, params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; rfiId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = ['subject','trade','directed_to','response_required_by','description','response','response_date','status','cost_impact','schedule_impact_days'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = $${vals.length + 1}`); vals.push(body[f]); }
      }
      if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
      vals.push(params.rfiId);
      const { rows } = await client.query(`UPDATE cpm_rfis SET ${sets.join(',')} WHERE id = $${vals.length} AND project_id = ${params.id} RETURNING *`, vals);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
