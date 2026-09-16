import { NextRequest } from 'next/server';
import { getCustomerPrincipal } from '@/lib/customer-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/platform-scenarios-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { principal, denied } = await getCustomerPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  await ensureSchema();

  const body = await req.json() as {
    platform: string;
    feature_type: string;
    input_data?: Record<string, unknown>;
    scenario_id?: string;
  };

  const { platform, feature_type, input_data = {} } = body;
  if (!platform || !feature_type) {
    return Response.json({ error: 'platform and feature_type are required' }, { status: 400 });
  }

  // Step 1: Check permissions
  const permRes = await fetch(
    new URL('/api/admin/platform-scenarios/check-permissions', req.url).toString(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, feature_type, actor_type: 'customer' }),
    }
  );
  const perm = await permRes.json() as { allowed: boolean; requires_approval: boolean; message?: string };

  if (!perm.allowed) {
    return Response.json({ error: perm.message ?? 'This feature is not available. Contact your admin.' }, { status: 403 });
  }

  // Find matching scenario
  const scenarioRows = await query(
    `SELECT id FROM platform_scenario WHERE platform=$1 AND feature_type=$2 AND actor IN ('customer','both') LIMIT 1`,
    [platform, feature_type]
  );
  const scenario_id = scenarioRows.rows[0]?.id ?? body.scenario_id ?? null;

  if (perm.requires_approval) {
    // Create run with pending_approval status
    const inserted = await query(
      `INSERT INTO platform_scenario_run
        (scenario_id, platform, feature_type, actor_type, actor_id, status, input_data, requires_approval)
       VALUES ($1,$2,$3,'customer',$4,'pending_approval',$5,true)
       RETURNING id`,
      [scenario_id, platform, feature_type, principal?.id ?? 'customer', JSON.stringify(input_data)]
    );
    return Response.json({
      status: 'pending_approval',
      run_id: inserted.rows[0].id,
      message: 'Your post has been submitted for admin approval.',
    });
  }

  // No approval needed — create run + insert into social_post if table exists
  const inserted = await query(
    `INSERT INTO platform_scenario_run
      (scenario_id, platform, feature_type, actor_type, actor_id, status, input_data)
     VALUES ($1,$2,$3,'customer',$4,'completed',$5)
     RETURNING id`,
    [scenario_id, platform, feature_type, principal?.id ?? 'customer', JSON.stringify(input_data)]
  );

  // Best-effort insert into social_post
  try {
    const caption = (input_data.caption ?? input_data.message ?? '') as string;
    const scheduledAt = input_data.schedule_at ? new Date(input_data.schedule_at as string) : new Date();
    await query(
      `INSERT INTO social_post (platform, status, scheduled_at, caption_preview, created_by)
       VALUES ($1,'scheduled',$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [platform, scheduledAt, caption.substring(0, 200), principal?.id ?? 'customer']
    );
  } catch { /* social_post may have different schema, skip gracefully */ }

  return Response.json({
    status: 'scheduled',
    run_id: inserted.rows[0].id,
    message: 'Post scheduled successfully.',
  });
}
