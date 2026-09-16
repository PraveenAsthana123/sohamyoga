import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/platform-scenarios-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  await ensureSchema();

  const body = await req.json() as {
    scenario_id: string;
    platform: string;
    feature_type: string;
    actor_type?: string;
    actor_id?: string;
    input_data?: Record<string, unknown>;
  };

  const { scenario_id, platform, feature_type, input_data = {} } = body;
  const actor_type = body.actor_type ?? 'admin';
  const actor_id = body.actor_id ?? 'admin';

  if (!scenario_id || !platform || !feature_type) {
    return Response.json({ error: 'scenario_id, platform, feature_type are required' }, { status: 400 });
  }

  const start = Date.now();
  const inserted = await query(
    `INSERT INTO platform_scenario_run
      (scenario_id, platform, feature_type, actor_type, actor_id, status, input_data)
     VALUES ($1,$2,$3,$4,$5,'started',$6)
     RETURNING id`,
    [scenario_id, platform, feature_type, actor_type, actor_id, JSON.stringify(input_data)]
  );
  const runId = inserted.rows[0].id as string;

  // Simulate execution (no real platform credentials needed for skeleton)
  const duration = Date.now() - start;
  await query(
    `UPDATE platform_scenario_run
     SET status='completed', output_data=$1, duration_ms=$2
     WHERE id=$3`,
    [JSON.stringify({ message: 'Scenario executed (simulation mode)', run_id: runId }), duration, runId]
  );

  return Response.json({ run_id: runId, status: 'completed', duration_ms: duration });
}
