export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM enterprise_process_instances WHERE id=$1 FOR UPDATE', [params.id]);
    if (!r.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const inst = r.rows[0];
    if (inst.status !== 'active') return Response.json({ error: 'Instance is not active' }, { status: 400 });
    const remaining: string[] = Array.isArray(inst.stages_remaining) ? inst.stages_remaining : JSON.parse(inst.stages_remaining || '[]');
    const completed: string[] = Array.isArray(inst.stages_completed) ? inst.stages_completed : JSON.parse(inst.stages_completed || '[]');
    if (remaining.length === 0) return Response.json({ error: 'No remaining stages — use complete endpoint' }, { status: 400 });
    const prevStage = inst.current_stage;
    const nextStage = remaining[0];
    const newRemaining = remaining.slice(1);
    const newCompleted = [...completed, prevStage];
    await client.query(
      `UPDATE enterprise_process_instances SET current_stage=$1,stages_completed=$2,stages_remaining=$3 WHERE id=$4`,
      [nextStage, JSON.stringify(newCompleted), JSON.stringify(newRemaining), params.id]
    );
    await client.query(
      `INSERT INTO enterprise_process_events (instance_id,stage,action,actor,notes) VALUES ($1,$2,'Stage Advanced',$3,$4)`,
      [params.id, nextStage, body.actor || 'System', body.notes || null]
    );
    return Response.json({ previous_stage: prevStage, current_stage: nextStage, stages_remaining: newRemaining });
  } finally { client.release(); }
}
