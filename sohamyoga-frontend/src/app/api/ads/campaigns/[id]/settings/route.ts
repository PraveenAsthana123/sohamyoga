import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BIDDING_STRATEGIES = ['manual_cpc', 'target_cpa', 'target_roas', 'maximize_clicks', 'maximize_conversions'];
const DEVICE_TARGETS = ['desktop', 'mobile', 'tablet', 'tv'];

// Real Bidding Screen + Placement (device targeting) Screen -- ad_campaign
// already has bidding_strategy and device_targets columns, and AdCampaign.ts
// already has setBiddingStrategy()/addDeviceTarget() domain logic, but
// nothing in the app ever called them: campaign creation hardcoded the
// column defaults and there was no route to change either afterward.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { biddingStrategy?: string; deviceTargets?: string[] } | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  if (body.biddingStrategy !== undefined && !BIDDING_STRATEGIES.includes(body.biddingStrategy)) {
    return Response.json({ error: `biddingStrategy must be one of ${BIDDING_STRATEGIES.join(', ')}.` }, { status: 400 });
  }
  if (body.deviceTargets !== undefined && !body.deviceTargets.every((d) => DEVICE_TARGETS.includes(d))) {
    return Response.json({ error: `deviceTargets must only contain ${DEVICE_TARGETS.join(', ')}.` }, { status: 400 });
  }

  const existing = await query<{ id: string }>('SELECT id FROM ad_campaign WHERE id = $1', [params.id]);
  if (!existing.rowCount) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  const result = await query<{ bidding_strategy: string; device_targets: string[] }>(
    `UPDATE ad_campaign SET
       bidding_strategy = COALESCE($2, bidding_strategy),
       device_targets = COALESCE($3, device_targets),
       updated_at = now()
     WHERE id = $1
     RETURNING bidding_strategy::text, device_targets::text[]`,
    [params.id, body.biddingStrategy ?? null, body.deviceTargets ?? null],
  );

  return Response.json({ biddingStrategy: result.rows[0].bidding_strategy, deviceTargets: result.rows[0].device_targets });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{ bidding_strategy: string; device_targets: string[] }>(
    'SELECT bidding_strategy::text, device_targets::text[] FROM ad_campaign WHERE id = $1',
    [params.id],
  );
  if (!result.rowCount) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  return Response.json({ biddingStrategy: result.rows[0].bidding_strategy, deviceTargets: result.rows[0].device_targets });
}
