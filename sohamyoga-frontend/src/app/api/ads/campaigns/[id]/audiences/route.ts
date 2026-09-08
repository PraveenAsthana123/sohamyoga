import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUDIENCE_TYPES = ['geo', 'device', 'language', 'interest', 'custom', 'lookalike'];

// Real audience-targeting rules per campaign -- the ad_audience table existed
// in the schema with zero API routes or UI referencing it anywhere. Manual
// rule entry only (no lookalike-modeling computation, no ad-platform sync --
// this app has no connected ad-platform account).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const rows = await query(
    `SELECT id, audience_type, segment_key, segment_value, bid_adjustment, is_excluded, created_at
     FROM ad_audience WHERE campaign_id = $1 ORDER BY created_at DESC`,
    [id],
  );
  return Response.json({
    audiences: rows.rows.map(r => ({
      id: r.id, audienceType: r.audience_type, segmentKey: r.segment_key, segmentValue: r.segment_value,
      bidAdjustment: r.bid_adjustment, isExcluded: r.is_excluded, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    audienceType?: string; segmentKey?: string; segmentValue?: string; bidAdjustment?: number; isExcluded?: boolean;
  } | null;
  if (!body?.audienceType || !AUDIENCE_TYPES.includes(body.audienceType) || !body.segmentKey?.trim() || !body.segmentValue?.trim()) {
    return Response.json({ error: `audienceType (${AUDIENCE_TYPES.join('|')}), segmentKey, and segmentValue are required.` }, { status: 400 });
  }
  const campaign = await query(`SELECT 1 FROM ad_campaign WHERE id = $1`, [id]);
  if (!campaign.rowCount) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  const result = await query<{ id: string }>(
    `INSERT INTO ad_audience (campaign_id, audience_type, segment_key, segment_value, bid_adjustment, is_excluded)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [id, body.audienceType, body.segmentKey.trim(), body.segmentValue.trim(), body.bidAdjustment ?? null, Boolean(body.isExcluded)],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
