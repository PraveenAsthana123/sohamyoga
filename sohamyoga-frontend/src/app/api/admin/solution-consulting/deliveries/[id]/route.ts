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
    const { rows } = await client.query(`
      SELECT d.*, o.client_name FROM consulting_deliveries d
      LEFT JOIN consulting_opportunities o ON o.id=d.opportunity_id
      WHERE d.id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ delivery: rows[0] });
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
    const allowed = ['name','status','milestones','team_members','start_date','end_date','health'] as const;
    for (const k of allowed) {
      if (k in b) { vals.push(k === 'milestones' ? JSON.stringify(b[k]) : b[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE consulting_deliveries SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ delivery: rows[0] });
  } finally { client.release(); }
}
