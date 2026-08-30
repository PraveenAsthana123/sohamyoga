import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../../lib/session-auth';
import { query } from '../../../../../lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { competitorId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { featureKey?: string; featureValue?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.featureKey) return Response.json({ error: 'featureKey is required.' }, { status: 400 });

  const result = await query(
    `INSERT INTO competitor_feature (competitor_id, feature_key, feature_value)
     VALUES ($1, $2, $3)
     ON CONFLICT (competitor_id, feature_key) DO UPDATE SET feature_value = EXCLUDED.feature_value, updated_at = now()
     RETURNING *`,
    [params.competitorId, body.featureKey, body.featureValue ?? ''],
  );
  return Response.json({ feature: result.rows[0] }, { status: 201 });
}
