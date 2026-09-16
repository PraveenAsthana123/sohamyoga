export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const opp = await client.query('SELECT * FROM consulting_opportunities WHERE id=$1', [params.id]);
    if (!opp.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const delivery = await client.query('SELECT * FROM consulting_deliveries WHERE opportunity_id=$1', [params.id]);
    return Response.json({ opportunity: opp.rows[0], delivery: delivery.rows[0] || null });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });
    const sets: string[] = []; const vals: unknown[] = [];
    const allowed = ['client_name','contact','description','stage','value','win_probability','solution_design','demo_date'] as const;
    for (const k of allowed) {
      if (k in b) { vals.push(b[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE consulting_opportunities SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ opportunity: rows[0] });
  } finally { client.release(); }
}
