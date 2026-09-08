import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manage the real pose sequence (plan_pose) for one personalized_plan.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const poses = await query(
    `SELECT pp.plan_id, pp.asana_id, pp.sequence_no, pp.hold_seconds, pp.cue, a.sanskrit_name, a.english_name, a.difficulty_level
     FROM plan_pose pp JOIN asana a ON a.id = pp.asana_id WHERE pp.plan_id = $1 ORDER BY pp.sequence_no`,
    [params.id],
  );
  return Response.json({ poses: poses.rows });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { asanaId?: string; sequenceNo?: number; holdSeconds?: number; cue?: string } | null;
  if (!body?.asanaId || !body.sequenceNo) return Response.json({ error: 'asanaId and sequenceNo are required.' }, { status: 400 });

  const plan = await query(`SELECT id FROM personalized_plan WHERE id = $1`, [params.id]);
  if (!plan.rowCount) return Response.json({ error: 'Plan not found.' }, { status: 404 });

  const result = await query(
    `INSERT INTO plan_pose (plan_id, asana_id, sequence_no, hold_seconds, cue) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (plan_id, asana_id) DO UPDATE SET sequence_no = EXCLUDED.sequence_no, hold_seconds = EXCLUDED.hold_seconds, cue = EXCLUDED.cue
     RETURNING *`,
    [params.id, body.asanaId, body.sequenceNo, body.holdSeconds ?? 30, body.cue || null],
  );
  return Response.json({ pose: result.rows[0] }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const asanaId = req.nextUrl.searchParams.get('asanaId');
  if (!asanaId) return Response.json({ error: 'asanaId query param is required.' }, { status: 400 });
  const result = await query(`DELETE FROM plan_pose WHERE plan_id = $1 AND asana_id = $2`, [params.id, asanaId]);
  if (!result.rowCount) return Response.json({ error: 'Pose not found in this plan.' }, { status: 404 });
  return Response.json({ ok: true });
}
